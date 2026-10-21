import { describe, expect, test } from "bun:test";
import { runPreGates } from "../../packages/runtime/grading/pre-gates.js";

describe("evidence-bound pre-gates", () => {
  const context = {
    skillName: "slides",
    telemetry: {
      skills_triggered: ["slides"],
      total_tool_calls: 1,
      assistant_turns: 1,
      errors_encountered: 0,
    },
    transcriptExcerpt: "[TOOL] Read /skills/other/SKILL.md",
  };

  test.each([
    "SKILL.md was read",
    "SKILL.md was read before editing files",
    "Expected tools were called",
    "session completed successfully",
    "No unhandled errors were encountered",
    "No more than 1 error encountered",
  ])("does not substitute proxy telemetry for %s", (expectation) => {
    expect(runPreGates([expectation], context)).toEqual({
      resolved: [],
      remaining: [expectation],
    });
  });

  test("resolves only the exact observed target trigger claim", () => {
    const text = "The skill was triggered during the session";
    const result = runPreGates([text], context);
    expect(result.remaining).toEqual([]);
    expect(result.resolved).toEqual([
      {
        text,
        passed: true,
        score: 1,
        source: "pre-gate",
        evidence: 'telemetry.skills_triggered includes "slides"',
      },
    ]);
  });

  test.each([{}, { skills_triggered: [] }, { skills_triggered: ["other"] }])(
    "missing target observation stays unresolved: %j",
    (telemetry) => {
      const text = "The skill was triggered during the session";
      expect(runPreGates([text], { ...context, telemetry })).toEqual({
        resolved: [],
        remaining: [text],
      });
    },
  );

  test("does not drop modifiers, negation, or another skill's identity", () => {
    const expectations = [
      'The "other" skill was triggered during the session',
      "The skill was not triggered during the session",
      "The skill was triggered during the session before any edits",
    ];
    expect(runPreGates(expectations, context)).toEqual({ resolved: [], remaining: expectations });
  });
});
