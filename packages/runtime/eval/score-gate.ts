import { CLIError } from "../utils/cli-error.js";

export function parseScoreThreshold(raw: string): number {
  const value = Number(raw);
  if (!raw.trim() || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new CLIError("--threshold must be between 0 and 1", "INVALID_ARGUMENT");
  }
  return value;
}

export function scoreGate(scores: readonly number[], threshold: number) {
  return scores.length > 0 && scores.every((score) => Number.isFinite(score) && score >= threshold);
}
