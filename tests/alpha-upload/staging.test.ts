/**
 * Tests for the canonical upload staging pipeline.
 *
 * Covers:
 *  - stageCanonicalRecords() inserting from JSONL
 *  - Dedup behavior (staging same records twice)
 *  - buildV2PushPayload() reading from staging with cursor
 *  - Evolution evidence staged alongside canonical records
 *  - Output passing PushPayloadV2Schema validation
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ALL_DDL, MIGRATIONS, POST_MIGRATION_INDEXES } from "../../cli/selftune/localdb/schema.js";
import { stageCanonicalRecords } from "../../cli/selftune/alpha-upload/stage-canonical.js";
import { buildV2PushPayload } from "../../cli/selftune/alpha-upload/build-payloads.js";
import { PushPayloadV2Schema } from "@selftune/telemetry-contract/schemas";

// -- Test helpers -------------------------------------------------------------

function createTestDb(): Database {
  const db = new Database(":memory:");
  for (const ddl of ALL_DDL) db.run(ddl);
  for (const m of MIGRATIONS) {
    try { db.run(m); } catch { /* duplicate column OK */ }
  }
  for (const idx of POST_MIGRATION_INDEXES) {
    try { db.run(idx); } catch { /* already exists OK */ }
  }
  return db;
}

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "staging-test-"));
}

function makeCanonicalSessionRecord(sessionId: string, overrides: Record<string, unknown> = {}) {
  return {
    record_kind: "session",
    schema_version: "2.0",
    normalizer_version: "1.0.0",
    normalized_at: "2026-03-18T10:00:00.000Z",
    platform: "claude_code",
    capture_mode: "replay",
    source_session_kind: "interactive",
    raw_source_ref: { path: "/some/transcript.jsonl" },
    session_id: sessionId,
    started_at: "2026-03-18T09:00:00.000Z",
    ended_at: "2026-03-18T09:30:00.000Z",
    model: "opus",
    completion_status: "completed",
    ...overrides,
  };
}

function makeCanonicalPromptRecord(promptId: string, sessionId: string, overrides: Record<string, unknown> = {}) {
  return {
    record_kind: "prompt",
    schema_version: "2.0",
    normalizer_version: "1.0.0",
    normalized_at: "2026-03-18T10:00:00.000Z",
    platform: "claude_code",
    capture_mode: "replay",
    source_session_kind: "interactive",
    raw_source_ref: {},
    session_id: sessionId,
    prompt_id: promptId,
    occurred_at: "2026-03-18T09:01:00.000Z",
    prompt_text: "improve my skills",
    prompt_kind: "user",
    is_actionable: true,
    prompt_index: 0,
    ...overrides,
  };
}

function makeCanonicalInvocationRecord(invId: string, sessionId: string, overrides: Record<string, unknown> = {}) {
  return {
    record_kind: "skill_invocation",
    schema_version: "2.0",
    normalizer_version: "1.0.0",
    normalized_at: "2026-03-18T10:00:00.000Z",
    platform: "claude_code",
    capture_mode: "replay",
    source_session_kind: "interactive",
    raw_source_ref: {},
    session_id: sessionId,
    skill_invocation_id: invId,
    occurred_at: "2026-03-18T09:02:00.000Z",
    skill_name: "selftune",
    invocation_mode: "implicit",
    triggered: true,
    confidence: 0.95,
    ...overrides,
  };
}

function makeCanonicalExecutionFactRecord(sessionId: string, overrides: Record<string, unknown> = {}) {
  return {
    record_kind: "execution_fact",
    schema_version: "2.0",
    normalizer_version: "1.0.0",
    normalized_at: "2026-03-18T10:00:00.000Z",
    platform: "claude_code",
    capture_mode: "replay",
    source_session_kind: "interactive",
    raw_source_ref: {},
    session_id: sessionId,
    execution_fact_id: overrides.execution_fact_id ?? `${sessionId}:2026-03-18T09:03:00.000Z:no-prompt`,
    occurred_at: "2026-03-18T09:03:00.000Z",
    tool_calls_json: { Read: 3, Edit: 2 },
    total_tool_calls: 5,
    assistant_turns: 3,
    errors_encountered: 0,
    ...overrides,
  };
}

function writeCanonicalJsonl(dir: string, records: unknown[]): string {
  const logPath = join(dir, "canonical_telemetry_log.jsonl");
  const content = records.map((r) => JSON.stringify(r)).join("\n") + (records.length > 0 ? "\n" : "");
  writeFileSync(logPath, content, "utf-8");
  return logPath;
}

function insertEvolutionEvidence(db: Database, overrides: Partial<{
  timestamp: string;
  proposal_id: string;
  skill_name: string;
  skill_path: string;
  target: string;
  stage: string;
  rationale: string;
  confidence: number;
  details: string;
  original_text: string;
  proposed_text: string;
}> = {}): void {
  const e = {
    timestamp: overrides.timestamp ?? "2026-03-18T10:10:00Z",
    proposal_id: overrides.proposal_id ?? `prop-${Math.random().toString(36).slice(2)}`,
    skill_name: overrides.skill_name ?? "selftune",
    skill_path: overrides.skill_path ?? "/path/to/SKILL.md",
    target: overrides.target ?? "description",
    stage: overrides.stage ?? "deployed",
    rationale: overrides.rationale ?? "improved routing accuracy",
    confidence: overrides.confidence ?? 0.85,
    details: overrides.details ?? "pass rate improved",
    original_text: overrides.original_text ?? "old description",
    proposed_text: overrides.proposed_text ?? "new description",
  };
  db.run(
    `INSERT INTO evolution_evidence (timestamp, proposal_id, skill_name, skill_path, target, stage, rationale, confidence, details, original_text, proposed_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [e.timestamp, e.proposal_id, e.skill_name, e.skill_path, e.target, e.stage, e.rationale, e.confidence, e.details, e.original_text, e.proposed_text],
  );
}

// -- Tests --------------------------------------------------------------------

describe("stageCanonicalRecords", () => {
  let db: Database;
  let tempDir: string;

  beforeEach(() => {
    db = createTestDb();
    tempDir = createTempDir();
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("stages canonical records from JSONL into staging table", () => {
    const logPath = writeCanonicalJsonl(tempDir, [
      makeCanonicalSessionRecord("sess-1"),
      makeCanonicalPromptRecord("p-1", "sess-1"),
      makeCanonicalInvocationRecord("inv-1", "sess-1"),
      makeCanonicalExecutionFactRecord("sess-1"),
    ]);

    const count = stageCanonicalRecords(db, logPath);
    expect(count).toBe(4);

    // Verify they're in the staging table
    const rows = db.query("SELECT * FROM canonical_upload_staging ORDER BY local_seq").all() as Array<{
      local_seq: number;
      record_kind: string;
      record_id: string;
      record_json: string;
      session_id: string | null;
    }>;
    expect(rows).toHaveLength(4);
    expect(rows[0].record_kind).toBe("session");
    expect(rows[0].record_id).toBe("sess-1");
    expect(rows[1].record_kind).toBe("prompt");
    expect(rows[1].record_id).toBe("p-1");
    expect(rows[2].record_kind).toBe("skill_invocation");
    expect(rows[2].record_id).toBe("inv-1");
    expect(rows[3].record_kind).toBe("execution_fact");
  });

  test("dedup -- staging same records twice does not create duplicates", () => {
    const logPath = writeCanonicalJsonl(tempDir, [
      makeCanonicalSessionRecord("sess-1"),
      makeCanonicalPromptRecord("p-1", "sess-1"),
    ]);

    const first = stageCanonicalRecords(db, logPath);
    expect(first).toBe(2);

    const second = stageCanonicalRecords(db, logPath);
    expect(second).toBe(0); // no new records

    const total = db.query("SELECT COUNT(*) as cnt FROM canonical_upload_staging").get() as { cnt: number };
    expect(total.cnt).toBe(2);
  });

  test("stages evolution evidence from SQLite", () => {
    // No canonical JSONL records
    const logPath = writeCanonicalJsonl(tempDir, []);

    // Insert evolution evidence into SQLite
    insertEvolutionEvidence(db, {
      proposal_id: "prop-1",
      skill_name: "selftune",
      stage: "deployed",
      timestamp: "2026-03-18T10:10:00Z",
    });

    const count = stageCanonicalRecords(db, logPath);
    expect(count).toBe(1);

    const rows = db.query("SELECT * FROM canonical_upload_staging").all() as Array<{
      record_kind: string;
      record_id: string;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].record_kind).toBe("evolution_evidence");
    expect(rows[0].record_id).toContain("prop-1");
  });

  test("preserves full canonical record JSON losslessly", () => {
    const session = makeCanonicalSessionRecord("sess-lossless", {
      raw_source_ref: { path: "/transcripts/abc.jsonl", line: 42 },
      capture_mode: "hook",
      normalizer_version: "2.5.0",
    });
    const logPath = writeCanonicalJsonl(tempDir, [session]);

    stageCanonicalRecords(db, logPath);

    const row = db.query("SELECT record_json FROM canonical_upload_staging WHERE record_id = 'sess-lossless'").get() as { record_json: string };
    const parsed = JSON.parse(row.record_json);

    // These fields should be preserved exactly as-is from the canonical log
    expect(parsed.raw_source_ref).toEqual({ path: "/transcripts/abc.jsonl", line: 42 });
    expect(parsed.capture_mode).toBe("hook");
    expect(parsed.normalizer_version).toBe("2.5.0");
    expect(parsed.schema_version).toBe("2.0");
  });

  test("uses execution_fact_id as record_id for execution facts", () => {
    const fact = makeCanonicalExecutionFactRecord("sess-efid", {
      execution_fact_id: "ef-custom-123",
    });

    const logPath = writeCanonicalJsonl(tempDir, [fact]);
    stageCanonicalRecords(db, logPath);

    const row = db.query("SELECT record_id FROM canonical_upload_staging WHERE record_kind = 'execution_fact'").get() as { record_id: string };
    expect(row.record_id).toBe("ef-custom-123");
  });

  test("generates deterministic record_id when execution_fact_id uses fallback format", () => {
    // The deterministic fallback format is session_id:occurred_at:prompt_id
    const fact = makeCanonicalExecutionFactRecord("sess-det", {
      execution_fact_id: "sess-det:2026-03-18T09:03:00.000Z:no-prompt",
    });

    const logPath = writeCanonicalJsonl(tempDir, [fact]);
    stageCanonicalRecords(db, logPath);

    const row = db.query("SELECT record_id FROM canonical_upload_staging WHERE record_kind = 'execution_fact'").get() as { record_id: string };
    expect(row.record_id).toBe("sess-det:2026-03-18T09:03:00.000Z:no-prompt");
  });

  test("returns 0 when JSONL file does not exist", () => {
    const count = stageCanonicalRecords(db, "/nonexistent/file.jsonl");
    expect(count).toBe(0);
  });
});

describe("buildV2PushPayload (staging-based)", () => {
  let db: Database;
  let tempDir: string;

  beforeEach(() => {
    db = createTestDb();
    tempDir = createTempDir();
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("returns null when staging table is empty", () => {
    const result = buildV2PushPayload(db);
    expect(result).toBeNull();
  });

  test("returns null when all records are past cursor", () => {
    const logPath = writeCanonicalJsonl(tempDir, [
      makeCanonicalSessionRecord("sess-1"),
    ]);
    stageCanonicalRecords(db, logPath);

    const result = buildV2PushPayload(db, 999999);
    expect(result).toBeNull();
  });

  test("builds payload from staged records", () => {
    const logPath = writeCanonicalJsonl(tempDir, [
      makeCanonicalSessionRecord("sess-1"),
      makeCanonicalPromptRecord("p-1", "sess-1"),
      makeCanonicalInvocationRecord("inv-1", "sess-1"),
      makeCanonicalExecutionFactRecord("sess-1"),
    ]);
    stageCanonicalRecords(db, logPath);

    const result = buildV2PushPayload(db);
    expect(result).not.toBeNull();

    const payload = result!.payload;
    expect(payload.schema_version).toBe("2.0");
    expect(payload.push_id).toBeDefined();

    const canonical = payload.canonical as Record<string, unknown[]>;
    expect(canonical.sessions).toHaveLength(1);
    expect(canonical.prompts).toHaveLength(1);
    expect(canonical.skill_invocations).toHaveLength(1);
    expect(canonical.execution_facts).toHaveLength(1);
  });

  test("returns correct lastSeq for cursor advancement", () => {
    const logPath = writeCanonicalJsonl(tempDir, [
      makeCanonicalSessionRecord("sess-1"),
      makeCanonicalSessionRecord("sess-2"),
    ]);
    stageCanonicalRecords(db, logPath);

    const first = buildV2PushPayload(db);
    expect(first).not.toBeNull();
    expect(first!.lastSeq).toBeGreaterThan(0);

    // Second call with cursor from first should return null
    const second = buildV2PushPayload(db, first!.lastSeq);
    expect(second).toBeNull();
  });

  test("respects limit parameter", () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      makeCanonicalSessionRecord(`sess-limit-${i}`)
    );
    const logPath = writeCanonicalJsonl(tempDir, records);
    stageCanonicalRecords(db, logPath);

    const result = buildV2PushPayload(db, undefined, 3);
    expect(result).not.toBeNull();

    const canonical = result!.payload.canonical as Record<string, unknown[]>;
    expect(canonical.sessions).toHaveLength(3);
  });

  test("includes evolution evidence in payload", () => {
    const logPath = writeCanonicalJsonl(tempDir, []);
    insertEvolutionEvidence(db, {
      proposal_id: "prop-evo",
      skill_name: "selftune",
      stage: "deployed",
      timestamp: "2026-03-18T10:10:00Z",
    });
    stageCanonicalRecords(db, logPath);

    const result = buildV2PushPayload(db);
    expect(result).not.toBeNull();

    const canonical = result!.payload.canonical as Record<string, unknown[]>;
    expect(canonical.evolution_evidence).toHaveLength(1);
    const ev = canonical.evolution_evidence[0] as Record<string, unknown>;
    expect(ev.skill_name).toBe("selftune");
    expect(ev.proposal_id).toBe("prop-evo");
  });

  test("payload passes PushPayloadV2Schema validation", () => {
    const logPath = writeCanonicalJsonl(tempDir, [
      makeCanonicalSessionRecord("sess-v"),
      makeCanonicalPromptRecord("p-v", "sess-v"),
      makeCanonicalInvocationRecord("inv-v", "sess-v"),
      makeCanonicalExecutionFactRecord("sess-v", { execution_fact_id: "ef-v" }),
    ]);
    stageCanonicalRecords(db, logPath);

    insertEvolutionEvidence(db, {
      proposal_id: "prop-v",
      skill_name: "selftune",
      stage: "deployed",
      timestamp: "2026-03-18T10:10:00.000Z",
    });
    // Re-stage to pick up evolution evidence
    stageCanonicalRecords(db, logPath);

    const result = buildV2PushPayload(db);
    expect(result).not.toBeNull();

    const parsed = PushPayloadV2Schema.safeParse(result!.payload);
    if (!parsed.success) {
      console.error("Zod validation errors:", JSON.stringify(parsed.error.issues, null, 2));
    }
    expect(parsed.success).toBe(true);
  });

  test("no hardcoded provenance fields -- canonical fields preserved from source", () => {
    const session = makeCanonicalSessionRecord("sess-prov", {
      capture_mode: "hook",
      normalizer_version: "3.0.0",
      raw_source_ref: { path: "/custom/path.jsonl", raw_id: "abc-123" },
    });
    const logPath = writeCanonicalJsonl(tempDir, [session]);
    stageCanonicalRecords(db, logPath);

    const result = buildV2PushPayload(db);
    const canonical = result!.payload.canonical as Record<string, unknown[]>;
    const s = canonical.sessions[0] as Record<string, unknown>;

    // These should come from the original record, NOT be hardcoded
    expect(s.capture_mode).toBe("hook");
    expect(s.normalizer_version).toBe("3.0.0");
    expect(s.raw_source_ref).toEqual({ path: "/custom/path.jsonl", raw_id: "abc-123" });
  });
});
