import { readFileSync, statSync } from "node:fs";
import { Schema } from "effect";
import { CLIError } from "../utils/cli-error.js";
import { scoreGate } from "./score-gate.js";
import type { EvaluationSummary } from "@selftune/control-plane/domain/evaluation-report";
type Assertion = EvaluationSummary["cases"][number]["assertions"][number];

const Grader = Schema.Struct({
  name: Schema.String,
  passed: Schema.Boolean,
  scored: Schema.optionalKey(Schema.Boolean),
  explanation: Schema.String,
});
const PortableGrader = Schema.Struct({
  text: Schema.String,
  passed: Schema.Boolean,
  scored: Schema.optionalKey(Schema.Boolean),
  evidence: Schema.String,
});

const Score = Schema.Number.check(Schema.isFinite(), Schema.isBetween({ minimum: 0, maximum: 1 }));
const NativeRun = Schema.Struct({
  score: Score,
  error: Schema.Union([Schema.String, Schema.Null]),
  skippedPaidGraders: Schema.Boolean,
  graders: Schema.optionalKey(Schema.Array(Grader)),
});
const NativeReport = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  claudeVersion: Schema.String,
  partial: Schema.Boolean,
  startedAt: Schema.optionalKey(Schema.String),
  suite: Schema.Struct({
    ablation: Schema.Literals(["none", "with-without"]),
    threshold: Schema.optionalKey(Score),
  }),
  cases: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      model: Schema.optionalKey(Schema.String),
      promptMarkdown: Schema.optionalKey(Schema.String),
      runsPerCase: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
      arms: Schema.Struct({
        with: Schema.Array(NativeRun),
        without: Schema.optionalKey(Schema.Array(NativeRun)),
      }),
    }),
  ),
});
const SkillReport = Schema.Struct({
  skill_name: Schema.String,
  agent: Schema.optionalKey(Schema.String),
  model: Schema.optionalKey(Schema.String),
  created_at: Schema.optionalKey(Schema.String),
  threshold: Schema.optionalKey(Score),
  baseline: Schema.Literals(["old_skill", "without_skill"]),
  cases: Schema.Array(
    Schema.Struct({
      id: Schema.Union([Schema.String, Schema.Number]),
      with_skill_pass_rate: Score,
      baseline_pass_rate: Score,
      prompt: Schema.optionalKey(Schema.String),
      with_skill_assertions: Schema.optionalKey(Schema.Array(PortableGrader)),
      baseline_assertions: Schema.optionalKey(Schema.Array(PortableGrader)),
    }),
  ),
});
const decodeReport = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.Union([NativeReport, SkillReport])),
);
const mean = (scores: readonly number[]) =>
  scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

export function summarizeEvalReport(raw: string, thresholdOverride?: number): EvaluationSummary {
  const report = decodeReport(raw);
  const threshold =
    thresholdOverride ??
    ("schemaVersion" in report ? report.suite.threshold : report.threshold) ??
    1;
  if ("schemaVersion" in report) {
    const cases = report.cases.map((entry) => {
      const without = entry.arms.without ?? [];
      const withScore = mean(entry.arms.with.map((run) => run.score));
      const baseline =
        report.suite.ablation === "with-without" ? mean(without.map((run) => run.score)) : null;
      const runs = [...entry.arms.with, ...without];
      const errors = runs.flatMap((run) => (run.error === null ? [] : [run.error]));
      const incomplete =
        entry.arms.with.length !== entry.runsPerCase ||
        (baseline !== null && without.length !== entry.runsPerCase) ||
        runs.some((run) => run.skippedPaidGraders) ||
        errors.length > 0;
      return {
        name: entry.name,
        score: withScore,
        baseline,
        delta: baseline === null ? null : withScore - baseline,
        incomplete,
        errors,
        prompt: entry.promptMarkdown ?? null,
        assertions: [
          ...entry.arms.with.flatMap((run) =>
            (run.graders ?? []).map<Assertion>((grader) => ({
              arm: "with",
              name: grader.name,
              passed: grader.passed,
              scored: grader.scored ?? true,
              evidence: grader.explanation,
            })),
          ),
          ...without.flatMap((run) =>
            (run.graders ?? []).map<Assertion>((grader) => ({
              arm: "baseline",
              name: grader.name,
              passed: grader.passed,
              scored: grader.scored ?? true,
              evidence: grader.explanation,
            })),
          ),
        ],
      };
    });
    const incomplete = report.partial || cases.some((entry) => entry.incomplete);
    return {
      engine: "claude-plugin",
      harness: "claude",
      model:
        [...new Set(report.cases.flatMap((entry) => (entry.model ? [entry.model] : [])))].join(
          ", ",
        ) || null,
      recordedAt: report.startedAt ?? null,
      threshold,
      cases,
      exitCode: incomplete
        ? 2
        : scoreGate(
              cases.map((entry) => entry.score),
              threshold,
            )
          ? 0
          : 1,
    };
  }
  const cases = report.cases.map((entry) => ({
    name: String(entry.id),
    score: entry.with_skill_pass_rate,
    baseline: entry.baseline_pass_rate,
    delta: entry.with_skill_pass_rate - entry.baseline_pass_rate,
    incomplete: false,
    errors: [],
    prompt: entry.prompt ?? null,
    assertions: [
      ...(entry.with_skill_assertions ?? []).map<Assertion>((grader) => ({
        arm: "with",
        name: grader.text,
        passed: grader.passed,
        scored: grader.scored ?? true,
        evidence: grader.evidence,
      })),
      ...(entry.baseline_assertions ?? []).map<Assertion>((grader) => ({
        arm: "baseline",
        name: grader.text,
        passed: grader.passed,
        scored: grader.scored ?? true,
        evidence: grader.evidence,
      })),
    ],
  }));
  return {
    engine: "selftune-skill",
    harness: report.agent ?? null,
    model: report.model ?? null,
    recordedAt: report.created_at ?? null,
    threshold,
    cases,
    exitCode: scoreGate(
      cases.map((entry) => entry.score),
      threshold,
    )
      ? 0
      : 1,
  };
}

export function readEvalReport(path: string, threshold: number) {
  if (statSync(path).size > 32 * 1024 * 1024) {
    throw new CLIError("Evaluation report exceeds the 32 MiB read limit", "INVALID_ARGUMENT");
  }
  return summarizeEvalReport(readFileSync(path, "utf8"), threshold);
}
