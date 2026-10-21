import * as Option from "effect/Option";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";
import type { EvalAction } from "./eval.js";

const optional = (name: string) => Flag.String(name).pipe(Flag.optional);

export function makePluginEvalCommand(action: EvalAction) {
  return Command.make(
    "plugin",
    {
      target: Flag.String("target").pipe(Flag.withDefault(".")),
      runs: Flag.String("runs").pipe(Flag.withDefault("3")),
      threshold: Flag.String("threshold").pipe(Flag.withDefault("1")),
      concurrency: Flag.String("concurrency").pipe(Flag.withDefault("1")),
      maxCostUsd: optional("max-cost-usd"),
      model: optional("model"),
      judgeModel: optional("judge-model"),
      case: optional("case"),
      evalDir: optional("eval-dir"),
      outputDir: optional("output-dir"),
      report: optional("report"),
      ablation: Flag.Literals("ablation", ["none", "with-without"]).pipe(
        Flag.withDefault("with-without"),
      ),
      trustPlugin: Flag.Boolean("trust-plugin")
        .pipe(Flag.withDefault(false))
        .pipe(Flag.withDescription("Explicitly trust the plugin and suite; never implied")),
      json: Flag.Boolean("json").pipe(Flag.withDefault(false)),
    },
    (input) =>
      action({
        action: "plugin",
        input: {
          ...input,
          maxCostUsd: Option.getOrUndefined(input.maxCostUsd),
          model: Option.getOrUndefined(input.model),
          judgeModel: Option.getOrUndefined(input.judgeModel),
          case: Option.getOrUndefined(input.case),
          evalDir: Option.getOrUndefined(input.evalDir),
          outputDir: Option.getOrUndefined(input.outputDir),
          report: Option.getOrUndefined(input.report),
        },
      }),
  ).pipe(
    Command.withDescription(
      "Run Claude-native plugin evals; keep reports local and preserve native CI exit codes",
    ),
  );
}
