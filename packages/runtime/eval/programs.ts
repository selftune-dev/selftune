import * as Effect from "effect/Effect";

import { CLIError } from "../utils/cli-error.js";
import type { EvalCommandRequest } from "./cli-contract.js";
import { saveEvaluationReport } from "./history.js";
import { parseScoreThreshold, scoreGate } from "./score-gate.js";

function toEvalCliError(cause: unknown, action: EvalCommandRequest["action"]): CLIError {
  return cause instanceof CLIError
    ? cause
    : new CLIError(
        cause instanceof Error ? cause.message : String(cause),
        "OPERATION_FAILED",
        `selftune eval ${action} --help`,
      );
}

export const runEvalProgram = Effect.fn("selftune.eval.run")(function* (
  request: EvalCommandRequest,
) {
  switch (request.action) {
    case "report": {
      const reader = yield* Effect.promise(() => import("./report.js"));
      const result = yield* Effect.try({
        try: () =>
          reader.readEvalReport(request.input.input, parseScoreThreshold(request.input.threshold)),
        catch: (cause) => toEvalCliError(cause, request.action),
      });
      console.log(
        request.input.json
          ? JSON.stringify(result, null, 2)
          : [
              `Engine: ${result.engine} | threshold: ${result.threshold} | exit: ${result.exitCode}`,
              "Case\tWith\tBaseline\tDelta\tErrors",
              ...result.cases.map((entry) =>
                [
                  entry.name,
                  entry.score.toFixed(2),
                  entry.baseline?.toFixed(2) ?? "—",
                  entry.delta?.toFixed(2) ?? "—",
                  entry.errors.join("; "),
                ].join("\t"),
              ),
            ].join("\n"),
      );
      process.exitCode = result.exitCode;
      return;
    }
    case "plugin": {
      const plugin = yield* Effect.promise(() => import("./plugin.js"));
      yield* plugin.runPluginEval(request.input);
      return;
    }
    case "generate": {
      const generator = yield* Effect.promise(() => import("./hooks-to-evals.js"));
      yield* Effect.tryPromise({
        try: () => generator.runEvalGenerate(request.input),
        catch: (cause) => toEvalCliError(cause, request.action),
      });
      return;
    }
    case "unit-test": {
      const unitTests = yield* Effect.promise(() => import("./unit-test-cli.js"));
      yield* Effect.tryPromise({
        try: () => unitTests.runEvalUnitTests(request.input),
        catch: (cause) => toEvalCliError(cause, request.action),
      });
      return;
    }
    case "run": {
      const threshold = yield* Effect.try({
        try: () =>
          request.input.threshold === undefined
            ? undefined
            : parseScoreThreshold(request.input.threshold),
        catch: (cause) => toEvalCliError(cause, request.action),
      });
      const runner = yield* Effect.promise(() => import("./output-quality.js"));
      if (!request.input.skillPath) {
        return yield* Effect.fail(
          new CLIError(
            "--skill-path <path> is required",
            "MISSING_FLAG",
            "selftune eval run --skill-path /path/to/SKILL.md",
          ),
        );
      }
      const result = yield* Effect.tryPromise({
        try: () =>
          runner.runOutputQualityEvaluation({
            skillPath: request.input.skillPath!,
            evalsPath: request.input.evals,
            workspacePath: request.input.workspace,
            baselineSkillPath: request.input.baselineSkillPath,
            feedbackPath: request.input.feedback,
            agent: request.input.agent,
            model: request.input.model,
            threshold,
          }),
        catch: (cause) => toEvalCliError(cause, request.action),
      });
      console.log(
        request.input.json
          ? JSON.stringify(result, null, 2)
          : `Evaluation iteration written to ${result.iteration_dir}`,
      );
      yield* Effect.try({
        try: () =>
          saveEvaluationReport(result.benchmark.skill_name, JSON.stringify(result.benchmark)),
        catch: (cause) => toEvalCliError(cause, request.action),
      });
      if (threshold !== undefined)
        process.exitCode = scoreGate(
          result.benchmark.cases.map((entry) => entry.with_skill_pass_rate),
          threshold,
        )
          ? 0
          : 1;
      return;
    }
    case "import": {
      const importer = yield* Effect.promise(() => import("./import-skillsbench.js"));
      yield* Effect.try({
        try: () => importer.runEvalImport(request.input),
        catch: (cause) => toEvalCliError(cause, request.action),
      });
      return;
    }
    case "composability": {
      const composability = yield* Effect.promise(() => import("./composability-program.js"));
      yield* composability.runComposabilityProgram(request.input);
      return;
    }
    case "family-overlap": {
      const familyOverlap = yield* Effect.promise(() => import("./family-overlap.js"));
      yield* Effect.tryPromise({
        try: () => familyOverlap.runEvalFamilyOverlap(request.input),
        catch: (cause) => toEvalCliError(cause, request.action),
      });
    }
  }
});
