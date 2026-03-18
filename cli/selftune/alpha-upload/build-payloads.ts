/**
 * V2 canonical push payload builder.
 *
 * Reads local SQLite rows (sessions, prompts, skill_invocations,
 * execution_facts, evolution_evidence) and constructs V2 canonical
 * records for the cloud API's POST /api/v1/push endpoint.
 *
 * Each table type uses its own rowid-based watermark for cursor
 * pagination, capped at 100 records per table per cycle.
 */

import type { Database } from "bun:sqlite";
import type {
  CanonicalRecord,
  CanonicalSessionRecord,
  CanonicalPromptRecord,
  CanonicalSkillInvocationRecord,
  CanonicalExecutionFactRecord,
} from "@selftune/telemetry-contract";
import type { EvolutionEvidenceEntry } from "../types.js";
import { buildPushPayloadV2 } from "../canonical-export.js";

// -- Types --------------------------------------------------------------------

/** Watermark state per table type. */
export interface Watermarks {
  sessions?: number;
  prompts?: number;
  invocations?: number;
  execution_facts?: number;
  evolution_evidence?: number;
}

export interface BuildV2Result {
  payload: Record<string, unknown>;
  newWatermarks: Watermarks;
}

// -- Constants ----------------------------------------------------------------

const DEFAULT_LIMIT = 100;
const NORMALIZER_VERSION = "1.0.0";
const SCHEMA_VERSION = "2.0" as const;

// -- Helpers ------------------------------------------------------------------

/** Parse a JSON string, returning null on failure. */
function safeParseJson<T>(json: string | null): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

// -- Per-table readers --------------------------------------------------------

function readSessions(
  db: Database,
  afterId?: number,
  limit: number = DEFAULT_LIMIT,
): { records: CanonicalSessionRecord[]; lastId: number } | null {
  const whereClause = afterId !== undefined ? "WHERE s.rowid > ?" : "";
  const params = afterId !== undefined ? [afterId, limit] : [limit];

  const sql = `
    SELECT
      s.rowid as _rowid,
      s.session_id,
      s.platform,
      s.model,
      s.started_at,
      s.ended_at,
      s.completion_status,
      s.source_session_kind,
      s.workspace_path,
      s.schema_version,
      s.normalized_at
    FROM sessions s
    ${whereClause}
    ORDER BY s.rowid ASC
    LIMIT ?
  `;

  const rows = db.query(sql).all(...params) as Array<{
    _rowid: number;
    session_id: string;
    platform: string | null;
    model: string | null;
    started_at: string | null;
    ended_at: string | null;
    completion_status: string | null;
    source_session_kind: string | null;
    workspace_path: string | null;
    schema_version: string | null;
    normalized_at: string | null;
  }>;

  if (rows.length === 0) return null;

  const records: CanonicalSessionRecord[] = rows.map((r) => ({
    record_kind: "session" as const,
    schema_version: SCHEMA_VERSION,
    normalizer_version: NORMALIZER_VERSION,
    normalized_at: r.normalized_at ?? new Date().toISOString(),
    platform: (r.platform ?? "claude_code") as CanonicalSessionRecord["platform"],
    capture_mode: "replay" as const,
    source_session_kind: (r.source_session_kind ?? "interactive") as CanonicalSessionRecord["source_session_kind"],
    raw_source_ref: {},
    session_id: r.session_id,
    started_at: r.started_at ?? undefined,
    ended_at: r.ended_at ?? undefined,
    model: r.model ?? undefined,
    completion_status: r.completion_status as CanonicalSessionRecord["completion_status"],
  }));

  return { records, lastId: rows[rows.length - 1]._rowid };
}

function readPrompts(
  db: Database,
  afterId?: number,
  limit: number = DEFAULT_LIMIT,
): { records: CanonicalPromptRecord[]; lastId: number } | null {
  const whereClause = afterId !== undefined ? "WHERE rowid > ?" : "";
  const params = afterId !== undefined ? [afterId, limit] : [limit];

  const sql = `
    SELECT
      rowid as _rowid,
      prompt_id,
      session_id,
      occurred_at,
      prompt_kind,
      is_actionable,
      prompt_index,
      prompt_text
    FROM prompts
    ${whereClause}
    ORDER BY rowid ASC
    LIMIT ?
  `;

  const rows = db.query(sql).all(...params) as Array<{
    _rowid: number;
    prompt_id: string;
    session_id: string;
    occurred_at: string | null;
    prompt_kind: string | null;
    is_actionable: number | null;
    prompt_index: number | null;
    prompt_text: string | null;
  }>;

  if (rows.length === 0) return null;

  const records: CanonicalPromptRecord[] = rows.map((r) => ({
    record_kind: "prompt" as const,
    schema_version: SCHEMA_VERSION,
    normalizer_version: NORMALIZER_VERSION,
    normalized_at: new Date().toISOString(),
    platform: "claude_code" as const,
    capture_mode: "replay" as const,
    source_session_kind: "interactive" as const,
    raw_source_ref: {},
    session_id: r.session_id,
    prompt_id: r.prompt_id,
    occurred_at: r.occurred_at ?? new Date().toISOString(),
    prompt_text: r.prompt_text ?? "",
    prompt_kind: (r.prompt_kind ?? "user") as CanonicalPromptRecord["prompt_kind"],
    is_actionable: r.is_actionable === 1,
    prompt_index: r.prompt_index ?? undefined,
  }));

  return { records, lastId: rows[rows.length - 1]._rowid };
}

function readInvocations(
  db: Database,
  afterId?: number,
  limit: number = DEFAULT_LIMIT,
): { records: CanonicalSkillInvocationRecord[]; lastId: number } | null {
  const whereClause = afterId !== undefined ? "WHERE rowid > ?" : "";
  const params = afterId !== undefined ? [afterId, limit] : [limit];

  const sql = `
    SELECT
      rowid as _rowid,
      skill_invocation_id,
      session_id,
      occurred_at,
      skill_name,
      invocation_mode,
      triggered,
      confidence,
      tool_name,
      matched_prompt_id,
      agent_type,
      query,
      skill_path,
      skill_scope,
      source
    FROM skill_invocations
    ${whereClause}
    ORDER BY rowid ASC
    LIMIT ?
  `;

  const rows = db.query(sql).all(...params) as Array<{
    _rowid: number;
    skill_invocation_id: string;
    session_id: string;
    occurred_at: string | null;
    skill_name: string;
    invocation_mode: string | null;
    triggered: number;
    confidence: number | null;
    tool_name: string | null;
    matched_prompt_id: string | null;
    agent_type: string | null;
    query: string;
    skill_path: string | null;
    skill_scope: string | null;
    source: string | null;
  }>;

  if (rows.length === 0) return null;

  const records: CanonicalSkillInvocationRecord[] = rows.map((r) => ({
    record_kind: "skill_invocation" as const,
    schema_version: SCHEMA_VERSION,
    normalizer_version: NORMALIZER_VERSION,
    normalized_at: new Date().toISOString(),
    platform: "claude_code" as const,
    capture_mode: "replay" as const,
    source_session_kind: "interactive" as const,
    raw_source_ref: {},
    session_id: r.session_id,
    skill_invocation_id: r.skill_invocation_id,
    occurred_at: r.occurred_at ?? new Date().toISOString(),
    skill_name: r.skill_name,
    invocation_mode: (r.invocation_mode ?? "implicit") as CanonicalSkillInvocationRecord["invocation_mode"],
    triggered: r.triggered === 1,
    confidence: r.confidence ?? undefined,
    tool_name: r.tool_name ?? undefined,
    matched_prompt_id: r.matched_prompt_id ?? undefined,
    agent_type: r.agent_type ?? undefined,
  }));

  return { records, lastId: rows[rows.length - 1]._rowid };
}

function readExecutionFacts(
  db: Database,
  afterId?: number,
  limit: number = DEFAULT_LIMIT,
): { records: CanonicalExecutionFactRecord[]; lastId: number } | null {
  const whereClause = afterId !== undefined ? "WHERE id > ?" : "";
  const params = afterId !== undefined ? [afterId, limit] : [limit];

  const sql = `
    SELECT
      id,
      session_id,
      occurred_at,
      prompt_id,
      tool_calls_json,
      total_tool_calls,
      assistant_turns,
      errors_encountered,
      input_tokens,
      output_tokens,
      duration_ms,
      completion_status
    FROM execution_facts
    ${whereClause}
    ORDER BY id ASC
    LIMIT ?
  `;

  const rows = db.query(sql).all(...params) as Array<{
    id: number;
    session_id: string;
    occurred_at: string | null;
    prompt_id: string | null;
    tool_calls_json: string | null;
    total_tool_calls: number | null;
    assistant_turns: number | null;
    errors_encountered: number | null;
    input_tokens: number | null;
    output_tokens: number | null;
    duration_ms: number | null;
    completion_status: string | null;
  }>;

  if (rows.length === 0) return null;

  const records: CanonicalExecutionFactRecord[] = rows.map((r) => ({
    record_kind: "execution_fact" as const,
    schema_version: SCHEMA_VERSION,
    normalizer_version: NORMALIZER_VERSION,
    normalized_at: new Date().toISOString(),
    platform: "claude_code" as const,
    capture_mode: "replay" as const,
    source_session_kind: "interactive" as const,
    raw_source_ref: {},
    session_id: r.session_id,
    occurred_at: r.occurred_at ?? new Date().toISOString(),
    prompt_id: r.prompt_id ?? undefined,
    tool_calls_json: safeParseJson<Record<string, number>>(r.tool_calls_json) ?? {},
    total_tool_calls: r.total_tool_calls ?? 0,
    assistant_turns: r.assistant_turns ?? 0,
    errors_encountered: r.errors_encountered ?? 0,
    input_tokens: r.input_tokens ?? undefined,
    output_tokens: r.output_tokens ?? undefined,
    duration_ms: r.duration_ms ?? undefined,
    completion_status: r.completion_status as CanonicalExecutionFactRecord["completion_status"],
  }));

  return { records, lastId: rows[rows.length - 1].id };
}

function readEvolutionEvidence(
  db: Database,
  afterId?: number,
  limit: number = DEFAULT_LIMIT,
): { entries: EvolutionEvidenceEntry[]; lastId: number } | null {
  const whereClause = afterId !== undefined ? "WHERE id > ?" : "";
  const params = afterId !== undefined ? [afterId, limit] : [limit];

  const sql = `
    SELECT
      id,
      timestamp,
      proposal_id,
      skill_name,
      skill_path,
      target,
      stage,
      rationale,
      confidence,
      details,
      original_text,
      proposed_text,
      eval_set_json,
      validation_json
    FROM evolution_evidence
    ${whereClause}
    ORDER BY id ASC
    LIMIT ?
  `;

  const rows = db.query(sql).all(...params) as Array<{
    id: number;
    timestamp: string;
    proposal_id: string;
    skill_name: string;
    skill_path: string | null;
    target: string | null;
    stage: string | null;
    rationale: string | null;
    confidence: number | null;
    details: string | null;
    original_text: string | null;
    proposed_text: string | null;
    eval_set_json: string | null;
    validation_json: string | null;
  }>;

  if (rows.length === 0) return null;

  const entries: EvolutionEvidenceEntry[] = rows.map((r) => ({
    timestamp: r.timestamp,
    proposal_id: r.proposal_id,
    skill_name: r.skill_name,
    skill_path: r.skill_path ?? "",
    target: (r.target ?? "description") as EvolutionEvidenceEntry["target"],
    stage: (r.stage ?? "created") as EvolutionEvidenceEntry["stage"],
    rationale: r.rationale ?? undefined,
    confidence: r.confidence ?? undefined,
    details: r.details ?? undefined,
    original_text: r.original_text ?? undefined,
    proposed_text: r.proposed_text ?? undefined,
    eval_set: safeParseJson(r.eval_set_json) ?? undefined,
    validation: safeParseJson(r.validation_json) ?? undefined,
  }));

  return { entries, lastId: rows[rows.length - 1].id };
}

// -- Main builder -------------------------------------------------------------

/**
 * Build a V2 canonical push payload from SQLite tables.
 *
 * Reads from sessions, prompts, skill_invocations, execution_facts,
 * and evolution_evidence using per-table rowid watermarks. Assembles
 * all records into a single V2 push payload via buildPushPayloadV2().
 *
 * Returns null when no new rows exist across any table.
 */
export function buildV2PushPayload(
  db: Database,
  watermarks: Watermarks,
): BuildV2Result | null {
  const allRecords: CanonicalRecord[] = [];
  const newWatermarks: Watermarks = {};

  // Sessions
  const sessions = readSessions(db, watermarks.sessions);
  if (sessions) {
    allRecords.push(...sessions.records);
    newWatermarks.sessions = sessions.lastId;
  }

  // Prompts
  const prompts = readPrompts(db, watermarks.prompts);
  if (prompts) {
    allRecords.push(...prompts.records);
    newWatermarks.prompts = prompts.lastId;
  }

  // Invocations
  const invocations = readInvocations(db, watermarks.invocations);
  if (invocations) {
    allRecords.push(...invocations.records);
    newWatermarks.invocations = invocations.lastId;
  }

  // Execution facts
  const execFacts = readExecutionFacts(db, watermarks.execution_facts);
  if (execFacts) {
    allRecords.push(...execFacts.records);
    newWatermarks.execution_facts = execFacts.lastId;
  }

  // Evolution evidence
  const evoEvidence = readEvolutionEvidence(db, watermarks.evolution_evidence);

  // If nothing new at all, return null
  if (allRecords.length === 0 && !evoEvidence) {
    return null;
  }

  const payload = buildPushPayloadV2(
    allRecords,
    evoEvidence?.entries ?? [],
  );

  if (evoEvidence) {
    newWatermarks.evolution_evidence = evoEvidence.lastId;
  }

  return { payload, newWatermarks };
}
