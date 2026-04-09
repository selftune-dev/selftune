import type { EvalEntry, ValidationMode } from "../types.js";
import { CLIError } from "../utils/cli-error.js";
import {
  runReplayValidation,
  type ReplayValidationOptions,
  type ReplayValidationResult,
} from "./engines/replay-engine.js";

export type ValidationStrategy = "auto" | "replay" | "judge";

export const DEFAULT_VALIDATION_STRATEGY: ValidationStrategy = "auto";

export interface ValidationExecutionResult<TResult> {
  result: TResult;
  modeUsed: ValidationMode;
}

export interface ValidationContractOptions<TResult> {
  mode?: ValidationStrategy;
  originalContent: string;
  proposedContent: string;
  evalSet: EvalEntry[];
  agent: string;
  replayOptions?: ReplayValidationOptions;
  runJudge: () => Promise<ValidationExecutionResult<TResult>>;
  adaptReplayResult: (replayResult: ReplayValidationResult) => TResult;
  onReplayFallback?: () => void;
}

export function hasReplayValidationPath(
  replayOptions?: ReplayValidationOptions,
): replayOptions is ReplayValidationOptions {
  return Boolean(replayOptions?.replayFixture || replayOptions?.replayRunner);
}

export function createReplayUnavailableError(): CLIError {
  return new CLIError(
    "Replay validation requested but no replay fixture or runner is available.",
    "REPLAY_UNAVAILABLE",
    "Use --validation-mode auto to allow judge fallback, or ensure the skill has a valid SKILL.md path for replay fixture construction.",
  );
}

export async function runValidationContract<TResult>(
  options: ValidationContractOptions<TResult>,
): Promise<ValidationExecutionResult<TResult>> {
  const mode = options.mode ?? DEFAULT_VALIDATION_STRATEGY;

  if (mode === "judge") {
    return options.runJudge();
  }

  if (hasReplayValidationPath(options.replayOptions)) {
    const replayResult = await runReplayValidation(
      options.originalContent,
      options.proposedContent,
      options.evalSet,
      options.agent,
      options.replayOptions,
    );

    if (replayResult) {
      return {
        result: options.adaptReplayResult(replayResult),
        modeUsed: replayResult.validation_mode,
      };
    }
  }

  if (mode === "replay") {
    throw createReplayUnavailableError();
  }

  options.onReplayFallback?.();
  return options.runJudge();
}
