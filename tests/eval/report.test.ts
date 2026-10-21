import { expect, test } from "bun:test";
import { summarizeEvalReport } from "../../packages/runtime/eval/report.js";

const run = { score: 1, error: null, skippedPaidGraders: false };
function native(error: string | null = null, partial = false) {
  return {
    schemaVersion: 1,
    claudeVersion: "2.1.269",
    partial,
    suite: { ablation: "with-without" },
    cases: [{ name: "smoke", runsPerCase: 1, arms: { with: [{ ...run, error }], without: [run] } }],
  };
}
test("native scores preserve neutral delta and engine provenance", () => {
  const result = summarizeEvalReport(JSON.stringify(native()), 1);
  expect(result.engine).toBe("claude-plugin");
  expect(result.cases[0]?.delta).toBe(0);
  expect(result.exitCode).toBe(0);
});
test("saved native thresholds are used unless a report command overrides them", () => {
  const report = JSON.stringify({
    ...native(),
    suite: { ablation: "with-without", threshold: 0.8 },
  });
  expect(summarizeEvalReport(report).threshold).toBe(0.8);
  expect(summarizeEvalReport(report, 0.9).threshold).toBe(0.9);
});
test("runtime errors and partial runs are not labeled quality regressions", () => {
  expect(summarizeEvalReport(JSON.stringify(native("rate limit")), 1).exitCode).toBe(2);
  expect(summarizeEvalReport(JSON.stringify(native(null, true)), 1).exitCode).toBe(2);
});
test("skill reports use the same per-case gate without equating engines", () => {
  const result = summarizeEvalReport(
    JSON.stringify({
      skill_name: "sample",
      baseline: "old_skill",
      cases: [{ id: 1, with_skill_pass_rate: 0.5, baseline_pass_rate: 0.75 }],
    }),
    0.8,
  );
  expect(result.engine).toBe("selftune-skill");
  expect(result.cases[0]?.delta).toBe(-0.25);
  expect(result.exitCode).toBe(1);
});
test("unknown versions and malformed scores fail closed", () => {
  expect(() => summarizeEvalReport(JSON.stringify({ ...native(), schemaVersion: 2 }), 1)).toThrow();
  expect(() => summarizeEvalReport('{"cases":[]}', 1)).toThrow();
});
