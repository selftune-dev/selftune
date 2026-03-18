/**
 * Tests for V2 canonical push payload builder.
 *
 * Validates that buildV2PushPayload correctly reads SQLite rows from
 * all 5 canonical tables and assembles them into a V2 push payload
 * via buildPushPayloadV2().
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { ALL_DDL, MIGRATIONS, POST_MIGRATION_INDEXES } from "../../cli/selftune/localdb/schema.js";
import {
  buildV2PushPayload,
  type Watermarks,
} from "../../cli/selftune/alpha-upload/build-payloads.js";

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

function insertSession(db: Database, overrides: Partial<{
  session_id: string;
  started_at: string;
  ended_at: string;
  platform: string;
  model: string;
  completion_status: string;
  workspace_path: string;
  source_session_kind: string;
}> = {}): void {
  const s = {
    session_id: overrides.session_id ?? `sess-${Math.random().toString(36).slice(2)}`,
    started_at: overrides.started_at ?? "2026-03-18T10:00:00Z",
    ended_at: overrides.ended_at ?? "2026-03-18T10:05:00Z",
    platform: overrides.platform ?? "claude_code",
    model: overrides.model ?? "opus",
    completion_status: overrides.completion_status ?? "completed",
    workspace_path: overrides.workspace_path ?? "/home/user/project",
    source_session_kind: overrides.source_session_kind ?? "interactive",
  };
  db.run(
    `INSERT INTO sessions (session_id, started_at, ended_at, platform, model, completion_status, workspace_path, source_session_kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [s.session_id, s.started_at, s.ended_at, s.platform, s.model, s.completion_status, s.workspace_path, s.source_session_kind],
  );
}

function insertPrompt(db: Database, overrides: Partial<{
  prompt_id: string;
  session_id: string;
  occurred_at: string;
  prompt_kind: string;
  is_actionable: number;
  prompt_index: number;
  prompt_text: string;
}> = {}): void {
  const p = {
    prompt_id: overrides.prompt_id ?? `prompt-${Math.random().toString(36).slice(2)}`,
    session_id: overrides.session_id ?? "sess-1",
    occurred_at: overrides.occurred_at ?? "2026-03-18T10:01:00Z",
    prompt_kind: overrides.prompt_kind ?? "user",
    is_actionable: overrides.is_actionable ?? 1,
    prompt_index: overrides.prompt_index ?? 0,
    prompt_text: overrides.prompt_text ?? "improve my skills",
  };
  db.run(
    `INSERT INTO prompts (prompt_id, session_id, occurred_at, prompt_kind, is_actionable, prompt_index, prompt_text)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p.prompt_id, p.session_id, p.occurred_at, p.prompt_kind, p.is_actionable, p.prompt_index, p.prompt_text],
  );
}

function insertInvocation(db: Database, overrides: Partial<{
  skill_invocation_id: string;
  session_id: string;
  occurred_at: string;
  skill_name: string;
  invocation_mode: string;
  triggered: number;
  confidence: number;
  query: string;
  skill_scope: string;
  source: string;
}> = {}): void {
  const inv = {
    skill_invocation_id: overrides.skill_invocation_id ?? `inv-${Math.random().toString(36).slice(2)}`,
    session_id: overrides.session_id ?? "sess-1",
    occurred_at: overrides.occurred_at ?? "2026-03-18T10:01:00Z",
    skill_name: overrides.skill_name ?? "selftune",
    invocation_mode: overrides.invocation_mode ?? "implicit",
    triggered: overrides.triggered ?? 1,
    confidence: overrides.confidence ?? 0.95,
    query: overrides.query ?? "improve my skills",
    skill_scope: overrides.skill_scope ?? "global",
    source: overrides.source ?? "hook",
  };
  db.run(
    `INSERT INTO skill_invocations (skill_invocation_id, session_id, occurred_at, skill_name, invocation_mode, triggered, confidence, query, skill_scope, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [inv.skill_invocation_id, inv.session_id, inv.occurred_at, inv.skill_name, inv.invocation_mode, inv.triggered, inv.confidence, inv.query, inv.skill_scope, inv.source],
  );
}

function insertExecutionFact(db: Database, overrides: Partial<{
  session_id: string;
  occurred_at: string;
  prompt_id: string;
  tool_calls_json: string;
  total_tool_calls: number;
  assistant_turns: number;
  errors_encountered: number;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number;
  completion_status: string;
}> = {}): void {
  const ef = {
    session_id: overrides.session_id ?? "sess-1",
    occurred_at: overrides.occurred_at ?? "2026-03-18T10:02:00Z",
    prompt_id: overrides.prompt_id ?? null,
    tool_calls_json: overrides.tool_calls_json ?? '{"Read":3,"Edit":2}',
    total_tool_calls: overrides.total_tool_calls ?? 5,
    assistant_turns: overrides.assistant_turns ?? 3,
    errors_encountered: overrides.errors_encountered ?? 0,
    input_tokens: overrides.input_tokens ?? 1000,
    output_tokens: overrides.output_tokens ?? 500,
    duration_ms: overrides.duration_ms ?? 30000,
    completion_status: overrides.completion_status ?? "completed",
  };
  db.run(
    `INSERT INTO execution_facts (session_id, occurred_at, prompt_id, tool_calls_json, total_tool_calls, assistant_turns, errors_encountered, input_tokens, output_tokens, duration_ms, completion_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ef.session_id, ef.occurred_at, ef.prompt_id, ef.tool_calls_json, ef.total_tool_calls, ef.assistant_turns, ef.errors_encountered, ef.input_tokens, ef.output_tokens, ef.duration_ms, ef.completion_status],
  );
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
  eval_set_json: string;
  validation_json: string;
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
    eval_set_json: overrides.eval_set_json ?? null,
    validation_json: overrides.validation_json ?? null,
  };
  db.run(
    `INSERT INTO evolution_evidence (timestamp, proposal_id, skill_name, skill_path, target, stage, rationale, confidence, details, original_text, proposed_text, eval_set_json, validation_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [e.timestamp, e.proposal_id, e.skill_name, e.skill_path, e.target, e.stage, e.rationale, e.confidence, e.details, e.original_text, e.proposed_text, e.eval_set_json, e.validation_json],
  );
}

// -- Tests --------------------------------------------------------------------

describe("buildV2PushPayload", () => {
  let db: Database;

  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test("returns null when no data exists", () => {
    const result = buildV2PushPayload(db, {});
    expect(result).toBeNull();
  });

  test("returns null when all watermarks are past existing data", () => {
    insertSession(db, { session_id: "sess-1" });
    const result = buildV2PushPayload(db, { sessions: 999999 });
    expect(result).toBeNull();
  });

  test("builds V2 payload with correct schema_version", () => {
    insertSession(db, { session_id: "sess-1" });
    const result = buildV2PushPayload(db, {});
    expect(result).not.toBeNull();

    const payload = result!.payload;
    expect(payload.schema_version).toBe("2.0");
    expect(payload.push_id).toBeDefined();
    expect(typeof payload.push_id).toBe("string");
  });

  test("includes sessions in canonical.sessions", () => {
    insertSession(db, {
      session_id: "sess-map",
      platform: "claude_code",
      model: "opus",
      started_at: "2026-03-18T10:00:00Z",
      ended_at: "2026-03-18T10:05:00Z",
      completion_status: "completed",
    });

    const result = buildV2PushPayload(db, {});
    const canonical = result!.payload.canonical as Record<string, unknown[]>;
    const sessions = canonical.sessions;

    expect(sessions).toHaveLength(1);
    const s = sessions[0] as Record<string, unknown>;
    expect(s.record_kind).toBe("session");
    expect(s.schema_version).toBe("2.0");
    expect(s.session_id).toBe("sess-map");
    expect(s.platform).toBe("claude_code");
    expect(s.model).toBe("opus");
    expect(s.started_at).toBe("2026-03-18T10:00:00Z");
    expect(s.ended_at).toBe("2026-03-18T10:05:00Z");
  });

  test("includes prompts in canonical.prompts", () => {
    insertPrompt(db, {
      prompt_id: "p-1",
      session_id: "sess-1",
      occurred_at: "2026-03-18T10:01:00Z",
      prompt_text: "improve my skills",
      prompt_kind: "user",
    });

    const result = buildV2PushPayload(db, {});
    const canonical = result!.payload.canonical as Record<string, unknown[]>;
    const prompts = canonical.prompts;

    expect(prompts).toHaveLength(1);
    const p = prompts[0] as Record<string, unknown>;
    expect(p.record_kind).toBe("prompt");
    expect(p.prompt_id).toBe("p-1");
    expect(p.prompt_text).toBe("improve my skills");
  });

  test("includes skill_invocations in canonical.skill_invocations", () => {
    insertInvocation(db, {
      skill_invocation_id: "inv-1",
      skill_name: "selftune",
      triggered: 1,
      confidence: 0.95,
    });

    const result = buildV2PushPayload(db, {});
    const canonical = result!.payload.canonical as Record<string, unknown[]>;
    const invocations = canonical.skill_invocations;

    expect(invocations).toHaveLength(1);
    const inv = invocations[0] as Record<string, unknown>;
    expect(inv.record_kind).toBe("skill_invocation");
    expect(inv.skill_name).toBe("selftune");
    expect(inv.triggered).toBe(true);
    expect(inv.confidence).toBe(0.95);
  });

  test("includes execution_facts in canonical.execution_facts", () => {
    insertExecutionFact(db, {
      session_id: "sess-1",
      total_tool_calls: 12,
      assistant_turns: 4,
      errors_encountered: 1,
    });

    const result = buildV2PushPayload(db, {});
    const canonical = result!.payload.canonical as Record<string, unknown[]>;
    const facts = canonical.execution_facts;

    expect(facts).toHaveLength(1);
    const f = facts[0] as Record<string, unknown>;
    expect(f.record_kind).toBe("execution_fact");
    expect(f.total_tool_calls).toBe(12);
    expect(f.assistant_turns).toBe(4);
    expect(f.errors_encountered).toBe(1);
  });

  test("includes evolution_evidence in canonical.evolution_evidence", () => {
    insertEvolutionEvidence(db, {
      proposal_id: "prop-1",
      skill_name: "selftune",
      target: "description",
      stage: "deployed",
      original_text: "old text",
      proposed_text: "new text",
    });

    const result = buildV2PushPayload(db, {});
    const canonical = result!.payload.canonical as Record<string, unknown[]>;
    const evidence = canonical.evolution_evidence;

    expect(evidence).toHaveLength(1);
    const e = evidence[0] as Record<string, unknown>;
    expect(e.skill_name).toBe("selftune");
    expect(e.proposal_id).toBe("prop-1");
    expect(e.original_text).toBe("old text");
    expect(e.proposed_text).toBe("new text");
  });

  test("returns watermarks for all table types with data", () => {
    insertSession(db, { session_id: "sess-1" });
    insertPrompt(db, { prompt_id: "p-1" });
    insertInvocation(db, { skill_invocation_id: "inv-1" });
    insertExecutionFact(db);
    insertEvolutionEvidence(db, { proposal_id: "prop-1" });

    const result = buildV2PushPayload(db, {});
    const wm = result!.newWatermarks;

    expect(wm.sessions).toBeGreaterThan(0);
    expect(wm.prompts).toBeGreaterThan(0);
    expect(wm.invocations).toBeGreaterThan(0);
    expect(wm.execution_facts).toBeGreaterThan(0);
    expect(wm.evolution_evidence).toBeGreaterThan(0);
  });

  test("respects watermarks -- skips already-uploaded rows", () => {
    insertSession(db, { session_id: "sess-1" });
    insertSession(db, { session_id: "sess-2" });

    // First call gets both
    const first = buildV2PushPayload(db, {});
    expect(first).not.toBeNull();
    const canonical1 = first!.payload.canonical as Record<string, unknown[]>;
    expect(canonical1.sessions).toHaveLength(2);

    // Second call with watermark from first should get nothing
    const second = buildV2PushPayload(db, { sessions: first!.newWatermarks.sessions });
    // Should be null since only sessions had data and those are past watermark
    expect(second).toBeNull();
  });

  test("handles mixed data -- some tables have data, others do not", () => {
    insertSession(db, { session_id: "sess-1" });
    insertInvocation(db, { skill_invocation_id: "inv-1" });
    // No prompts, execution_facts, or evolution_evidence

    const result = buildV2PushPayload(db, {});
    expect(result).not.toBeNull();

    const canonical = result!.payload.canonical as Record<string, unknown[]>;
    expect(canonical.sessions).toHaveLength(1);
    expect(canonical.skill_invocations).toHaveLength(1);
    expect(canonical.prompts).toHaveLength(0);
    expect(canonical.execution_facts).toHaveLength(0);
    expect(canonical.evolution_evidence).toHaveLength(0);

    // Watermarks only set for tables with data
    expect(result!.newWatermarks.sessions).toBeGreaterThan(0);
    expect(result!.newWatermarks.invocations).toBeGreaterThan(0);
    expect(result!.newWatermarks.prompts).toBeUndefined();
    expect(result!.newWatermarks.execution_facts).toBeUndefined();
    expect(result!.newWatermarks.evolution_evidence).toBeUndefined();
  });

  test("canonical records have required base fields", () => {
    insertSession(db, { session_id: "sess-fields" });

    const result = buildV2PushPayload(db, {});
    const canonical = result!.payload.canonical as Record<string, unknown[]>;
    const session = canonical.sessions[0] as Record<string, unknown>;

    expect(session.record_kind).toBe("session");
    expect(session.schema_version).toBe("2.0");
    expect(session.normalizer_version).toBeDefined();
    expect(session.normalized_at).toBeDefined();
    expect(session.platform).toBeDefined();
    expect(session.capture_mode).toBeDefined();
    expect(session.raw_source_ref).toBeDefined();
  });
});

describe("batch size cap", () => {
  let db: Database;

  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  test("default limit caps at 100 records per table", () => {
    for (let i = 0; i < 120; i++) {
      insertInvocation(db, {
        skill_invocation_id: `inv-cap-${i}`,
        query: `query ${i}`,
      });
    }

    const result = buildV2PushPayload(db, {});
    const canonical = result!.payload.canonical as Record<string, unknown[]>;
    // Should cap at 100
    expect(canonical.skill_invocations).toHaveLength(100);
  });
});
