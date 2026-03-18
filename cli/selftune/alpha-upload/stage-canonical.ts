/**
 * Canonical upload staging writer.
 *
 * Reads canonical records from the JSONL source-of-truth log and evolution
 * evidence from SQLite, then inserts them into a single monotonic staging
 * table for lossless upload batching.
 *
 * The staging table preserves the full canonical record JSON -- no field
 * dropping, no hardcoding of provenance fields.
 */

import type { Database } from "bun:sqlite";
import type { CanonicalRecord } from "@selftune/telemetry-contract";
import { CANONICAL_LOG } from "../constants.js";
import { readCanonicalRecords } from "../utils/canonical-log.js";
import { queryEvolutionEvidence } from "../localdb/queries.js";

// -- Helpers ------------------------------------------------------------------

/**
 * Extract a stable record_id from a canonical record.
 *
 * Uses the natural primary key for each record kind:
 *  - session: session_id
 *  - prompt: prompt_id
 *  - skill_invocation: skill_invocation_id
 *  - execution_fact: execution_fact_id (or deterministic fallback)
 *  - normalization_run: run_id
 */
function extractRecordId(record: CanonicalRecord): string {
  switch (record.record_kind) {
    case "session":
      return record.session_id;
    case "prompt":
      return record.prompt_id;
    case "skill_invocation":
      return record.skill_invocation_id;
    case "execution_fact": {
      // Use execution_fact_id if present, otherwise deterministic fallback
      if (record.execution_fact_id) return record.execution_fact_id;
      const promptPart = record.prompt_id ?? "no-prompt";
      return `${record.session_id}:${record.occurred_at}:${promptPart}`;
    }
    case "normalization_run":
      return record.run_id;
  }
}

/**
 * Extract session_id from a canonical record (if the record has one).
 */
function extractSessionId(record: CanonicalRecord): string | null {
  if ("session_id" in record) return record.session_id;
  return null;
}

/**
 * Extract prompt_id from a canonical record (if the record has one).
 */
function extractPromptId(record: CanonicalRecord): string | null {
  if ("prompt_id" in record) return record.prompt_id;
  return null;
}

/**
 * Extract normalized_at from a canonical record.
 */
function extractNormalizedAt(record: CanonicalRecord): string {
  return record.normalized_at;
}

// -- Main staging function ----------------------------------------------------

/**
 * Stage canonical records from the JSONL log and evolution evidence from SQLite
 * into the canonical_upload_staging table.
 *
 * Uses INSERT OR IGNORE for dedup by (record_kind, record_id).
 *
 * @param db - SQLite database handle
 * @param logPath - Path to canonical JSONL log (defaults to CANONICAL_LOG)
 * @returns Number of newly staged records
 */
export function stageCanonicalRecords(
  db: Database,
  logPath: string = CANONICAL_LOG,
): number {
  let staged = 0;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO canonical_upload_staging
      (record_kind, record_id, record_json, session_id, prompt_id, normalized_at, staged_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Stage canonical records from JSONL
  const records = readCanonicalRecords(logPath);
  for (const record of records) {
    const recordId = extractRecordId(record);
    const result = stmt.run(
      record.record_kind,
      recordId,
      JSON.stringify(record),
      extractSessionId(record),
      extractPromptId(record),
      extractNormalizedAt(record),
      now,
    );
    if (result.changes > 0) staged++;
  }

  // 2. Stage evolution evidence from SQLite
  try {
    const evidence = queryEvolutionEvidence(db);
    for (const entry of evidence) {
      const recordId = `${entry.proposal_id}:${entry.stage}:${entry.timestamp}`;
      const recordJson = JSON.stringify({
        skill_name: entry.skill_name,
        proposal_id: entry.proposal_id,
        target: entry.target,
        stage: entry.stage,
        rationale: entry.rationale,
        confidence: entry.confidence,
        original_text: entry.original_text,
        proposed_text: entry.proposed_text,
        eval_set_json: entry.eval_set,
        validation_json: entry.validation,
      });

      const result = stmt.run(
        "evolution_evidence",
        recordId,
        recordJson,
        null, // no session_id for evolution evidence
        null, // no prompt_id
        entry.timestamp,
        now,
      );
      if (result.changes > 0) staged++;
    }
  } catch (err) {
    if (process.env.DEBUG || process.env.NODE_ENV === "development") {
      console.error("[stage-canonical] failed to stage evolution evidence:", err);
    }
  }

  return staged;
}
