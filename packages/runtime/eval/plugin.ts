import { spawn } from "node:child_process";
import * as Effect from "effect/Effect";
import { CLIError } from "../utils/cli-error.js";
import { parseScoreThreshold } from "./score-gate.js";

export interface PluginEvalInput {
  readonly target: string;
  readonly runs: string;
  readonly threshold: string;
  readonly concurrency: string;
  readonly maxCostUsd?: string;
  readonly model?: string;
  readonly judgeModel?: string;
  readonly case?: string;
  readonly evalDir?: string;
  readonly outputDir?: string;
  readonly report?: string;
  readonly ablation: "none" | "with-without";
  readonly trustPlugin: boolean;
  readonly json: boolean;
}

export function pluginEvalArguments(input: PluginEvalInput): string[] {
  parseScoreThreshold(input.threshold);
  for (const [name, raw, min, max, integer] of [
    ["runs", input.runs, 1, 100, true],
    ["concurrency", input.concurrency, 1, 8, true],
    ["max-cost-usd", input.maxCostUsd ?? "1", Number.MIN_VALUE, Infinity, false],
  ] satisfies [string, string, number, number, boolean][]) {
    const value = Number(raw);
    if (
      !raw.trim() ||
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    ) {
      throw new CLIError(
        `Invalid --${name}: ${raw}`,
        "INVALID_ARGUMENT",
        "selftune eval plugin --help",
      );
    }
  }
  if (!input.target.trim() || input.target.startsWith("-")) {
    throw new CLIError("Provide a plugin path or installed plugin name", "INVALID_ARGUMENT");
  }
  const args = [
    "plugin",
    "eval",
    input.target,
    "--no-publish",
    "--no-scaffold",
    "--mocks",
    "record",
    "--runs",
    input.runs,
    "--threshold",
    input.threshold,
    "--concurrency",
    input.concurrency,
    "--ablation",
    input.ablation,
  ];
  for (const [flag, value] of [
    ["--max-cost-usd", input.maxCostUsd],
    ["--model", input.model],
    ["--judge-model", input.judgeModel],
    ["--case", input.case],
    ["--eval-dir", input.evalDir],
    ["--output-dir", input.outputDir],
    ["--report", input.report],
  ] satisfies [string, string | undefined][])
    if (value !== undefined) args.push(flag, value);
  if (input.trustPlugin) args.push("--trust-plugin");
  if (input.json) args.push("--json");
  return args;
}

export const runPluginEval = Effect.fn("selftune.eval.plugin")(function* (input: PluginEvalInput) {
  const args = yield* Effect.try({
    try: () => pluginEvalArguments(input),
    catch: (cause) =>
      cause instanceof CLIError ? cause : new CLIError(String(cause), "INVALID_ARGUMENT"),
  });
  const exitCode = yield* Effect.tryPromise({
    try: (signal) =>
      new Promise<number>((resolve, reject) => {
        const child = spawn("claude", args, { stdio: "inherit", signal });
        child.once("error", reject);
        child.once("close", (code) => resolve(code ?? 2));
      }),
    catch: (cause) =>
      new CLIError(
        `Claude plugin evaluation could not start: ${cause instanceof Error ? cause.message : String(cause)}`,
        "OPERATION_FAILED",
        "Requires Claude Code 2.1.269 or later: claude plugin eval --help",
      ),
  });
  process.exitCode = exitCode;
});
