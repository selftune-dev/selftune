import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { selectAcceptedPackageFrontierCandidate } from "@selftune/runtime/create/package-candidate-state";
import { readCanonicalPackageEvaluationArtifact } from "@selftune/runtime/testing-readiness";
import { PUBLIC_COMMAND_SURFACES, renderCommandHelp } from "@selftune/runtime/command-surface";
import { CLIError, handleCLIError } from "@selftune/runtime/utils/cli-error";

const IMPROVE_SCOPES = ["auto", "description", "routing", "body", "package"] as const;
type ImproveScope = (typeof IMPROVE_SCOPES)[number];

export interface ImproveDeps {
  evolveCliMain?: () => Promise<void>;
  evolveBodyCliMain?: () => Promise<void>;
  searchRunCliMain?: () => Promise<void>;
  historicalImprove?: (input: {
    readonly skill: string;
    readonly skillPath: string;
    readonly agent?: string;
    readonly budgetRemainingUsd: number;
    readonly estimatedCostUsd: number;
  }) => Promise<{ readonly handled: boolean; readonly result?: unknown }>;
}

function readOptionValue(args: readonly string[], flag: string): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === flag) {
      const next = args[index + 1];
      return next && !next.startsWith("-") ? next : undefined;
    }
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
  }
  return undefined;
}

function stripOption(args: readonly string[], flag: string): string[] {
  const result: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === flag) {
      const next = args[index + 1];
      if (next && !next.startsWith("-")) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith(`${flag}=`)) {
      continue;
    }
    result.push(arg);
  }
  return result;
}

function hasOption(args: readonly string[], flag: string): boolean {
  return args.includes(flag) || args.some((arg) => arg.startsWith(`${flag}=`));
}

function readRequiredUsdAmount(args: readonly string[], flag: string): number {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === flag) {
      const next = args[index + 1];
      if (next === undefined) {
        throw new CLIError(`${flag} requires a non-negative USD amount.`, "MISSING_FLAG");
      }
      values.push(next);
      index += 1;
    } else if (arg.startsWith(`${flag}=`)) {
      values.push(arg.slice(flag.length + 1));
    }
  }

  if (values.length === 0 || values[0] === "") {
    throw new CLIError(`${flag} requires a non-negative USD amount.`, "MISSING_FLAG");
  }
  if (values.length > 1) {
    throw new CLIError(`${flag} can only be provided once.`, "INVALID_FLAG");
  }

  const [rawValue] = values;
  if (rawValue === undefined || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(rawValue)) {
    throw new CLIError(`${flag} must be a finite, non-negative USD amount.`, "INVALID_FLAG");
  }
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    throw new CLIError(`${flag} must be a finite, non-negative USD amount.`, "INVALID_FLAG");
  }
  return value;
}

function replaceOption(args: readonly string[], sourceFlag: string, targetFlag: string): string[] {
  const value = readOptionValue(args, sourceFlag);
  if (value == null) {
    return stripOption(args, sourceFlag);
  }
  const result = stripOption(args, sourceFlag);
  result.push(targetFlag, value);
  return result;
}

function resolveScope(rawScope: string | undefined): ImproveScope {
  const scope = IMPROVE_SCOPES.find((scope) => scope === (rawScope ?? "auto"));
  if (scope === undefined) {
    throw new CLIError(
      `Invalid --scope value: ${rawScope}`,
      "INVALID_FLAG",
      "Use one of: auto, description, routing, body, package",
    );
  }
  return scope;
}

function inferSkillNameFromArgs(args: readonly string[]): string | null {
  const explicitSkill = readOptionValue(args, "--skill");
  if (explicitSkill) return explicitSkill;

  const skillPath = readOptionValue(args, "--skill-path");
  if (!skillPath) return null;
  return basename(dirname(skillPath));
}

function shouldAutoSelectPackageScope(args: readonly string[]): boolean {
  const skillPath = readOptionValue(args, "--skill-path");
  if (!skillPath) return false;

  if (existsSync(join(dirname(skillPath), "selftune.create.json"))) {
    return true;
  }

  const skillName = inferSkillNameFromArgs(args);
  if (!skillName) return false;

  return (
    selectAcceptedPackageFrontierCandidate(skillName) != null ||
    readCanonicalPackageEvaluationArtifact(skillName) != null
  );
}

export async function runImprove(
  rawArgs: readonly string[],
  deps: ImproveDeps = {},
): Promise<void> {
  const { evolveCliMain, evolveBodyCliMain, searchRunCliMain, historicalImprove } = deps;

  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    console.log(renderCommandHelp(PUBLIC_COMMAND_SURFACES.improve));
    process.exit(0);
  }

  const requestedScope = readOptionValue(rawArgs, "--scope");
  if (rawArgs.includes("--scope") && requestedScope == null) {
    throw new CLIError(
      "--scope requires a value.",
      "MISSING_FLAG",
      "Use one of: auto, description, routing, body, package",
    );
  }

  const scope = resolveScope(requestedScope);
  const effectiveScope =
    scope === "auto" && shouldAutoSelectPackageScope(rawArgs) ? "package" : scope;
  let delegatedArgs = stripOption(rawArgs, "--scope");

  if (hasOption(delegatedArgs, "--target")) {
    throw new CLIError(
      "Use --scope on selftune improve instead of passing --target directly.",
      "INVALID_FLAG",
      "selftune improve --skill <name> --skill-path <path> --scope routing|body",
    );
  }

  const historicalBudgetFlags = ["--budget-remaining-usd", "--estimated-cost-usd"];
  const hasHistoricalBudgetInput = historicalBudgetFlags.some((flag) =>
    hasOption(delegatedArgs, flag),
  );
  const isHistoricalReplayDryRun =
    effectiveScope === "auto" && hasOption(delegatedArgs, "--dry-run");
  if (hasHistoricalBudgetInput && (!isHistoricalReplayDryRun || !historicalImprove)) {
    throw new CLIError(
      "Spend estimates are only used by the historical replay dry-run.",
      "INVALID_FLAG",
      "Pass both spend flags with --scope auto --dry-run, --skill, and --skill-path.",
    );
  }

  if (isHistoricalReplayDryRun && historicalImprove) {
    const skill = readOptionValue(delegatedArgs, "--skill");
    const skillPath = readOptionValue(delegatedArgs, "--skill-path");
    if (hasHistoricalBudgetInput && (!skill || !skillPath)) {
      throw new CLIError(
        "Caller spend inputs require both --skill and --skill-path.",
        "MISSING_FLAG",
        "Pass --skill <name> and --skill-path <path> with both spend flags.",
      );
    }
    if (skill && skillPath) {
      const budgetRemainingUsd = readRequiredUsdAmount(delegatedArgs, "--budget-remaining-usd");
      const estimatedCostUsd = readRequiredUsdAmount(delegatedArgs, "--estimated-cost-usd");
      if (estimatedCostUsd > budgetRemainingUsd) {
        throw new CLIError(
          `Historical replay was not started: estimated total run cost ($${estimatedCostUsd}) exceeds caller-reported remaining spend ($${budgetRemainingUsd}).`,
          "GUARD_BLOCKED",
          "Review the total-run estimate and the remaining amount, then rerun with current caller-provided values.",
        );
      }
      delegatedArgs = historicalBudgetFlags.reduce(
        (args, flag) => stripOption(args, flag),
        delegatedArgs,
      );
      const historical = await historicalImprove({
        skill,
        skillPath,
        agent: readOptionValue(delegatedArgs, "--agent"),
        budgetRemainingUsd,
        estimatedCostUsd,
      });
      if (historical.handled) {
        console.log(JSON.stringify(historical.result, null, 2));
        return;
      }
    }
  }

  if (effectiveScope === "package") {
    const dryRunRequested = hasOption(delegatedArgs, "--dry-run");
    const validationMode = readOptionValue(delegatedArgs, "--validation-mode");
    if (hasOption(delegatedArgs, "--validation-mode")) {
      if (validationMode == null) {
        throw new CLIError(
          "--validation-mode requires a value.",
          "MISSING_FLAG",
          "Use one of: auto, replay",
        );
      }
      if (!["auto", "replay"].includes(validationMode)) {
        throw new CLIError(
          "Package search uses replay-backed package evaluation and does not support judge-only validation.",
          "INVALID_FLAG",
          "Use selftune improve --scope package without --validation-mode, or set --validation-mode replay",
        );
      }
      delegatedArgs = stripOption(delegatedArgs, "--validation-mode");
    }

    delegatedArgs = stripOption(delegatedArgs, "--dry-run");

    if (hasOption(delegatedArgs, "--candidates") && !hasOption(delegatedArgs, "--max-candidates")) {
      delegatedArgs = replaceOption(delegatedArgs, "--candidates", "--max-candidates");
    }
    if (!dryRunRequested && !hasOption(delegatedArgs, "--apply-winner")) {
      delegatedArgs.push("--apply-winner");
    }

    process.argv = [process.argv[0], process.argv[1], ...delegatedArgs];
    const { cliMain: delegatedCliMain } = searchRunCliMain
      ? { cliMain: searchRunCliMain }
      : await import("./search-run.js");
    await delegatedCliMain();
    return;
  }

  if (effectiveScope === "routing" || effectiveScope === "body") {
    const delegatedAgent = readOptionValue(delegatedArgs, "--agent");
    if (
      delegatedAgent &&
      !hasOption(delegatedArgs, "--teacher-agent") &&
      !hasOption(delegatedArgs, "--student-agent")
    ) {
      delegatedArgs = stripOption(delegatedArgs, "--agent");
      delegatedArgs.push("--teacher-agent", delegatedAgent, "--student-agent", delegatedAgent);
    }

    delegatedArgs.push("--target", effectiveScope);
    process.argv = [process.argv[0], process.argv[1], ...delegatedArgs];
    const { cliMain: delegatedCliMain } = evolveBodyCliMain
      ? { cliMain: evolveBodyCliMain }
      : await import("@selftune/runtime/evolution/evolve-body");
    await delegatedCliMain();
    return;
  }

  process.argv = [process.argv[0], process.argv[1], ...delegatedArgs];
  const { cliMain: delegatedCliMain } = evolveCliMain
    ? { cliMain: evolveCliMain }
    : await import("./evolve.js");
  await delegatedCliMain();
}

export async function cliMain(): Promise<void> {
  await runImprove(process.argv.slice(2));
}

if (import.meta.main) {
  cliMain().catch(handleCLIError);
}
