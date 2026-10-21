import { describe, expect, mock, test } from "bun:test";

import { assembleResult, gradeSession } from "../../packages/runtime/grading/grade-session.js";
import type { GraderOutput } from "../../packages/runtime/types/grading.js";
import type { SessionTelemetryRecord } from "../../packages/runtime/types.js";

function makeTelemetryRecord(
  overrides: Partial<SessionTelemetryRecord> = {},
): SessionTelemetryRecord {
  return {
    timestamp: "2025-01-15T10:00:00Z",
    session_id: "sess-abc",
    cwd: "/tmp/test",
    transcript_path: "/tmp/transcript.jsonl",
    tool_calls: { Read: 1 },
    total_tool_calls: 1,
    bash_commands: [],
    skills_triggered: ["pptx"],
    assistant_turns: 2,
    errors_encountered: 0,
    transcript_chars: 200,
    last_user_query: "create slides",
    ...overrides,
  };
}

describe("gradeSession", () => {
  const base = {
    expectations: ["session completed successfully"],
    telemetry: makeTelemetryRecord(),
    sessionId: "sess-abc",
    skillName: "pptx",
    transcriptExcerpt: "[ASSISTANT] Starting work",
    transcriptPath: "/tmp/transcript.jsonl",
    agent: "codex",
  };
  const incomplete: GraderOutput = {
    expectations: [],
    unobserved_expectations: [
      { text: "session completed successfully", reason: "Only the start of work is captured" },
    ],
    summary: { passed: 0, failed: 0, total: 0, pass_rate: 0 },
    claims: [],
    eval_feedback: { suggestions: [], overall: "Incomplete evidence" },
  };

  test("blocks incomplete evidence instead of persisting a synthetic failure or pass", async () => {
    const grader = mock(async () => incomplete);
    await expect(gradeSession({ ...base, gradeViaAgentFn: grader })).rejects.toThrow(
      "unobserved evidence",
    );
    expect(grader).toHaveBeenCalledTimes(1);
    expect(() => assembleResult(incomplete, base.telemetry, "sess", "pptx", "source")).toThrow(
      "unobserved evidence",
    );
  });

  test.each(["", "(no transcript)", "(transcript not found)"])(
    "missing transcript source %j blocks before a model call",
    async (transcriptExcerpt) => {
      const grader = mock(async () => incomplete);
      await expect(
        gradeSession({ ...base, transcriptExcerpt, gradeViaAgentFn: grader }),
      ).rejects.toThrow("source transcript evidence is unavailable");
      expect(grader).not.toHaveBeenCalled();
    },
  );

  test("rejects an empty rubric before a model call", async () => {
    const grader = mock(async () => incomplete);
    await expect(
      gradeSession({ ...base, expectations: [], gradeViaAgentFn: grader }),
    ).rejects.toThrow("at least one expectation");
    expect(grader).not.toHaveBeenCalled();
  });

  test("rejects duplicate or substituted judgments even with a matching count", async () => {
    const grader = mock(async () => ({
      ...incomplete,
      unobserved_expectations: [],
      expectations: [{ text: "a different task", passed: true, evidence: "irrelevant" }],
    }));
    await expect(gradeSession({ ...base, gradeViaAgentFn: grader })).rejects.toThrow(
      "duplicate or unrelated expectations",
    );
  });

  test("keeps a real observed failure separate from incomplete evidence", async () => {
    const grader = mock(async () => ({
      ...incomplete,
      unobserved_expectations: [],
      expectations: [
        {
          text: base.expectations[0],
          passed: false,
          evidence: "Terminal task result reports exit 1 and unrecovered failure",
          score: 0,
        },
      ],
    }));
    const result = await gradeSession({ ...base, gradeViaAgentFn: grader });
    expect(result.summary).toMatchObject({ passed: 0, failed: 1, total: 1, pass_rate: 0 });
  });

  test("observed trigger-only rubric still avoids a model call", async () => {
    const grader = mock(async () => incomplete);
    const result = await gradeSession({
      ...base,
      expectations: ["The skill was triggered during the session"],
      gradeViaAgentFn: grader,
    });
    expect(grader).not.toHaveBeenCalled();
    expect(result.summary).toMatchObject({ passed: 1, failed: 0, total: 1, pass_rate: 1 });
  });

  test("throws when the grader returns the wrong number of expectation results", async () => {
    const mockGradeViaAgent = mock(async () => ({
      expectations: [],
      summary: { passed: 0, failed: 0, total: 0, pass_rate: 0, mean_score: 0 },
      claims: [],
      eval_feedback: { suggestions: [], overall: "" },
    }));

    await expect(
      gradeSession({
        expectations: ["The final output was well structured"],
        telemetry: makeTelemetryRecord(),
        sessionId: "sess-abc",
        skillName: "pptx",
        transcriptExcerpt: "[USER] create slides",
        transcriptPath: "/tmp/transcript.jsonl",
        agent: "openclaw",
        gradeViaAgentFn: mockGradeViaAgent,
      }),
    ).rejects.toThrow("Grader returned 0 expectations for 1 unresolved expectations");
  });
});
