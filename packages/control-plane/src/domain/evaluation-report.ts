import { Schema } from "effect";

const Score = Schema.Number.check(Schema.isFinite(), Schema.isBetween({ minimum: 0, maximum: 1 }));
export const EvaluationAssertion = Schema.Struct({
  arm: Schema.Literals(["with", "baseline"]),
  name: Schema.String,
  passed: Schema.Boolean,
  scored: Schema.Boolean,
  evidence: Schema.String,
});
export const EvaluationSummary = Schema.Struct({
  engine: Schema.Literals(["claude-plugin", "selftune-skill"]),
  harness: Schema.Union([Schema.String, Schema.Null]),
  model: Schema.Union([Schema.String, Schema.Null]),
  recordedAt: Schema.Union([Schema.String, Schema.Null]),
  threshold: Score,
  exitCode: Schema.Literals([0, 1, 2]),
  cases: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      score: Score,
      baseline: Schema.Union([Score, Schema.Null]),
      delta: Schema.Union([Schema.Number, Schema.Null]),
      incomplete: Schema.Boolean,
      errors: Schema.Array(Schema.String),
      prompt: Schema.Union([Schema.String, Schema.Null]),
      assertions: Schema.Array(EvaluationAssertion),
    }),
  ),
});
export type EvaluationSummary = typeof EvaluationSummary.Type;
export const EvaluationHistory = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    importedAt: Schema.String,
    result: EvaluationSummary,
  }),
);
export type EvaluationHistory = typeof EvaluationHistory.Type;
