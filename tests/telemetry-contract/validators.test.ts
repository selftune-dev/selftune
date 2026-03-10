import { describe, expect, test } from "bun:test";
import {
  CANONICAL_SCHEMA_VERSION,
  isCanonicalRecord,
} from "../../packages/telemetry-contract/src/index.js";

describe("telemetry contract validators", () => {
  test("accepts a valid canonical prompt record", () => {
    expect(
      isCanonicalRecord({
        record_kind: "prompt",
        schema_version: CANONICAL_SCHEMA_VERSION,
        normalizer_version: "1.0.0",
        normalized_at: "2026-03-10T10:00:00.000Z",
        platform: "claude_code",
        capture_mode: "hook",
        source_session_kind: "interactive",
        session_id: "sess-1",
        raw_source_ref: { event_type: "UserPromptSubmit" },
        prompt_id: "sess-1:p0",
        occurred_at: "2026-03-10T10:00:00.000Z",
        prompt_text: "Build the landing page",
        prompt_kind: "user",
        is_actionable: true,
      }),
    ).toBe(true);
  });

  test("rejects malformed canonical records", () => {
    expect(
      isCanonicalRecord({
        record_kind: "prompt",
        schema_version: CANONICAL_SCHEMA_VERSION,
        normalizer_version: "1.0.0",
        normalized_at: "2026-03-10T10:00:00.000Z",
        platform: "claude_code",
        capture_mode: "hook",
        source_session_kind: "interactive",
        session_id: "sess-1",
        raw_source_ref: { event_type: "UserPromptSubmit" },
        prompt_id: "sess-1:p0",
        occurred_at: "2026-03-10T10:00:00.000Z",
        prompt_text: "Build the landing page",
        prompt_kind: "not-a-kind",
        is_actionable: true,
      }),
    ).toBe(false);
  });
});
