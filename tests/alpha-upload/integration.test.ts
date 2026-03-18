/**
 * Integration tests for the alpha upload orchestration module (V2).
 *
 * Tests prepareUploads, runUploadCycle, API key flow, and fail-open contract.
 * Uses an in-memory SQLite database with the full schema applied.
 */

import { Database } from "bun:sqlite";
import { describe, expect, it, beforeEach, mock } from "bun:test";

import {
  ALL_DDL,
  CREATE_UPLOAD_QUEUE,
  CREATE_UPLOAD_WATERMARKS,
  MIGRATIONS,
  POST_MIGRATION_INDEXES,
} from "../../cli/selftune/localdb/schema.js";
import { enqueueUpload, getQueueStats } from "../../cli/selftune/alpha-upload/queue.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createTestDb(): Database {
  const db = new Database(":memory:");
  db.exec("PRAGMA journal_mode = WAL");
  for (const ddl of ALL_DDL) {
    db.exec(ddl);
  }
  for (const migration of MIGRATIONS) {
    try {
      db.exec(migration);
    } catch {
      // Duplicate column errors are expected
    }
  }
  for (const idx of POST_MIGRATION_INDEXES) {
    db.exec(idx);
  }
  return db;
}

/** Seed sessions for payload building. */
function seedSessions(db: Database, count: number): void {
  for (let i = 0; i < count; i++) {
    const sid = `session-${i}`;
    db.run(
      `INSERT INTO sessions (session_id, platform, model, workspace_path, started_at, ended_at, completion_status)
       VALUES (?, 'claude_code', 'opus', '/test/workspace', '2026-01-01T00:00:00Z', '2026-01-01T01:00:00Z', 'completed')`,
      [sid],
    );
  }
}

/** Seed prompts for payload building. */
function seedPrompts(db: Database, count: number): void {
  for (let i = 0; i < count; i++) {
    db.run(
      `INSERT INTO prompts (prompt_id, session_id, occurred_at, prompt_kind, is_actionable, prompt_index, prompt_text)
       VALUES (?, 'session-0', '2026-01-01T00:00:00Z', 'user', 1, ?, 'test prompt')`,
      [`prompt-${i}`, i],
    );
  }
}

/** Seed skill_invocations for payload building. */
function seedInvocations(db: Database, count: number): void {
  for (let i = 0; i < count; i++) {
    db.run(
      `INSERT INTO skill_invocations (skill_invocation_id, session_id, occurred_at, skill_name, invocation_mode, triggered, confidence, query, skill_scope, source)
       VALUES (?, 'session-0', '2026-01-01T00:00:00Z', 'Research', 'implicit', 1, 0.9, 'test query', 'global', 'sync')`,
      [`inv-${i}`],
    );
  }
}

/** Seed execution_facts for payload building. */
function seedExecutionFacts(db: Database, count: number): void {
  for (let i = 0; i < count; i++) {
    db.run(
      `INSERT INTO execution_facts (session_id, occurred_at, tool_calls_json, total_tool_calls, assistant_turns, errors_encountered)
       VALUES ('session-0', '2026-01-01T00:00:00Z', '{"Read":3}', 3, 2, 0)`,
    );
  }
}

/** Seed evolution_evidence for payload building. */
function seedEvolutionEvidence(db: Database, count: number): void {
  for (let i = 0; i < count; i++) {
    db.run(
      `INSERT INTO evolution_evidence (timestamp, proposal_id, skill_name, skill_path, target, stage, rationale, confidence)
       VALUES ('2026-01-01T00:00:00Z', ?, 'Research', '/path/SKILL.md', 'description', 'deployed', 'improved accuracy', 0.85)`,
      [`prop-${i}`],
    );
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("alpha-upload/index -- prepareUploads (V2)", () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("returns empty summary when no new rows exist", async () => {
    const { prepareUploads } = await import("../../cli/selftune/alpha-upload/index.js");
    const result = prepareUploads(db, "test-user", "claude_code", "0.2.7");
    expect(result.enqueued).toBe(0);
    expect(result.types).toEqual([]);
  });

  it("enqueues a single V2 push payload from sessions", async () => {
    seedSessions(db, 3);
    const { prepareUploads } = await import("../../cli/selftune/alpha-upload/index.js");
    const result = prepareUploads(db, "test-user", "claude_code", "0.2.7");
    expect(result.enqueued).toBe(1);
    expect(result.types).toContain("sessions");

    const stats = getQueueStats(db);
    expect(stats.pending).toBe(1);
  });

  it("enqueues payload including invocations", async () => {
    seedSessions(db, 1);
    seedInvocations(db, 5);
    const { prepareUploads } = await import("../../cli/selftune/alpha-upload/index.js");
    const result = prepareUploads(db, "test-user", "claude_code", "0.2.7");
    expect(result.types).toContain("sessions");
    expect(result.types).toContain("invocations");
  });

  it("enqueues payload including evolution_evidence", async () => {
    seedEvolutionEvidence(db, 2);
    const { prepareUploads } = await import("../../cli/selftune/alpha-upload/index.js");
    const result = prepareUploads(db, "test-user", "claude_code", "0.2.7");
    expect(result.types).toContain("evolution_evidence");
  });

  it("enqueues payload including all 5 table types", async () => {
    seedSessions(db, 1);
    seedPrompts(db, 2);
    seedInvocations(db, 3);
    seedExecutionFacts(db, 1);
    seedEvolutionEvidence(db, 1);
    const { prepareUploads } = await import("../../cli/selftune/alpha-upload/index.js");
    const result = prepareUploads(db, "test-user", "claude_code", "0.2.7");
    expect(result.enqueued).toBe(1);
    expect(result.types).toContain("sessions");
    expect(result.types).toContain("prompts");
    expect(result.types).toContain("invocations");
    expect(result.types).toContain("execution_facts");
    expect(result.types).toContain("evolution_evidence");
  });

  it("respects watermarks -- does not re-enqueue already-uploaded rows", async () => {
    seedSessions(db, 3);
    const { prepareUploads } = await import("../../cli/selftune/alpha-upload/index.js");

    // First call enqueues
    const first = prepareUploads(db, "test-user", "claude_code", "0.2.7");
    expect(first.enqueued).toBe(1);

    // Second call finds no new rows (watermarks advanced)
    const second = prepareUploads(db, "test-user", "claude_code", "0.2.7");
    expect(second.enqueued).toBe(0);
  });

  it("produces V2 payload with schema_version 2.0", async () => {
    seedSessions(db, 1);
    const { prepareUploads } = await import("../../cli/selftune/alpha-upload/index.js");
    prepareUploads(db, "test-user", "claude_code", "0.2.7");

    // Read the queued payload
    const row = db.query("SELECT payload_json FROM upload_queue WHERE status = 'pending' LIMIT 1").get() as { payload_json: string };
    const payload = JSON.parse(row.payload_json);
    expect(payload.schema_version).toBe("2.0");
    expect(payload.push_id).toBeDefined();
    expect(payload.canonical).toBeDefined();
    expect(payload.canonical.sessions).toBeDefined();
  });
});

describe("alpha-upload/index -- runUploadCycle (V2)", () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("returns empty summary when unenrolled", async () => {
    const { runUploadCycle } = await import("../../cli/selftune/alpha-upload/index.js");
    const result = await runUploadCycle(db, {
      enrolled: false,
      endpoint: "https://api.selftune.dev/api/v1/push",
    });
    expect(result.enrolled).toBe(false);
    expect(result.prepared).toBe(0);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("prepares and flushes when enrolled (dry-run)", async () => {
    seedSessions(db, 2);

    const { runUploadCycle } = await import("../../cli/selftune/alpha-upload/index.js");
    const result = await runUploadCycle(db, {
      enrolled: true,
      userId: "test-user",
      agentType: "claude_code",
      selftuneVersion: "0.2.7",
      endpoint: "https://api.selftune.dev/api/v1/push",
      dryRun: true,
    });

    expect(result.enrolled).toBe(true);
    expect(result.prepared).toBe(1);
    // In dry-run mode, nothing is actually sent
    expect(result.sent).toBe(0);
  });

  it("passes apiKey through to flush", async () => {
    seedSessions(db, 1);
    const originalFetch = globalThis.fetch;
    let capturedHeaders: Headers | null = null;

    globalThis.fetch = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true, push_id: "id", errors: [] }), { status: 200 });
    });

    try {
      const { runUploadCycle } = await import("../../cli/selftune/alpha-upload/index.js");
      await runUploadCycle(db, {
        enrolled: true,
        userId: "test-user",
        agentType: "claude_code",
        selftuneVersion: "0.2.7",
        endpoint: "https://api.selftune.dev/api/v1/push",
        apiKey: "test-secret-key",
      });

      expect(capturedHeaders).not.toBeNull();
      expect(capturedHeaders!.get("Authorization")).toBe("Bearer test-secret-key");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not throw on upload errors", async () => {
    seedSessions(db, 1);
    const { runUploadCycle } = await import("../../cli/selftune/alpha-upload/index.js");

    // Pre-enqueue an item with corrupt JSON to force immediate failure
    enqueueUpload(db, "push", "not-valid-json");

    const result = await runUploadCycle(db, {
      enrolled: true,
      userId: "test-user",
      agentType: "claude_code",
      selftuneVersion: "0.2.7",
      endpoint: "http://localhost:1/nonexistent",
      dryRun: true,
    });

    // Should not throw -- fail open
    expect(result.enrolled).toBe(true);
    expect(typeof result.prepared).toBe("number");
    expect(typeof result.sent).toBe("number");
    expect(typeof result.failed).toBe("number");
  });
});

describe("alpha-upload/index -- fail-open guarantees (V2)", () => {
  it("prepareUploads never throws even with a broken database", async () => {
    const { prepareUploads } = await import("../../cli/selftune/alpha-upload/index.js");
    const db = new Database(":memory:");
    // No schema applied -- all queries will fail
    const result = prepareUploads(db, "test-user", "claude_code", "0.2.7");
    expect(result.enqueued).toBe(0);
    expect(result.types).toEqual([]);
  });

  it("runUploadCycle never throws even with a broken database", async () => {
    const { runUploadCycle } = await import("../../cli/selftune/alpha-upload/index.js");
    const db = new Database(":memory:");
    // No schema applied
    const result = await runUploadCycle(db, {
      enrolled: true,
      userId: "test-user",
      agentType: "claude_code",
      selftuneVersion: "0.2.7",
      endpoint: "https://api.selftune.dev/api/v1/push",
    });
    expect(result.enrolled).toBe(true);
    expect(result.prepared).toBe(0);
  });
});
