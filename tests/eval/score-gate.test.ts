import { expect, test } from "bun:test";
import { parseScoreThreshold, scoreGate } from "../../packages/runtime/eval/score-gate.js";

test("score gates reject empty results, nonfinite scores, and any failing case", () => {
  expect(scoreGate([], 0)).toBe(false);
  expect(scoreGate([1, 0.79], 0.8)).toBe(false);
  expect(scoreGate([1, 0.8], 0.8)).toBe(true);
  expect(scoreGate([NaN], 0)).toBe(false);
});
test("thresholds are validated before any paid execution", () => {
  for (const raw of ["", "NaN", "Infinity", "-0.1", "1.1"])
    expect(() => parseScoreThreshold(raw)).toThrow();
  expect(parseScoreThreshold("0.8")).toBe(0.8);
});
