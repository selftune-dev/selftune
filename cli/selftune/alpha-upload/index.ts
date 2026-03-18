/**
 * Alpha upload orchestration module.
 *
 * Coordinates the full upload cycle:
 *   1. Read new rows since watermark from SQLite (all 5 canonical tables)
 *   2. Build a single V2 canonical push payload
 *   3. Enqueue it in the local upload queue
 *   4. Flush the queue to POST /api/v1/push
 *
 * Guards:
 *   - Only runs when alpha enrolled (config.alpha?.enrolled === true)
 *   - Fail-open: never throws, returns empty summary on errors
 *   - Reads endpoint from config or SELFTUNE_ALPHA_ENDPOINT env var
 */

import type { Database } from "bun:sqlite";

import type { FlushSummary, QueueItem as ContractQueueItem, QueueOperations } from "../alpha-upload-contract.js";
import { buildV2PushPayload, type Watermarks } from "./build-payloads.js";
import { enqueueUpload, readWatermark, writeWatermark, getPendingUploads, markSending, markSent, markFailed } from "./queue.js";
import { flushQueue } from "./flush.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ENDPOINT = "https://api.selftune.dev/api/v1/push";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrepareResult {
  enqueued: number;
  types: string[];
}

export interface UploadCycleOptions {
  enrolled: boolean;
  userId?: string;
  agentType?: string;
  selftuneVersion?: string;
  endpoint?: string;
  dryRun?: boolean;
  apiKey?: string;
}

export interface UploadCycleSummary {
  enrolled: boolean;
  prepared: number;
  sent: number;
  failed: number;
  skipped: number;
}

// ---------------------------------------------------------------------------
// Watermark helpers
// ---------------------------------------------------------------------------

/** Read all per-table watermarks from the upload_watermarks table. */
function readAllWatermarks(db: Database): Watermarks {
  return {
    sessions: readWatermark(db, "sessions") ?? undefined,
    prompts: readWatermark(db, "prompts") ?? undefined,
    invocations: readWatermark(db, "invocations") ?? undefined,
    execution_facts: readWatermark(db, "execution_facts") ?? undefined,
    evolution_evidence: readWatermark(db, "evolution_evidence") ?? undefined,
  };
}

/** Write updated watermarks back to the upload_watermarks table. */
function writeAllWatermarks(db: Database, watermarks: Watermarks): void {
  if (watermarks.sessions !== undefined) writeWatermark(db, "sessions", watermarks.sessions);
  if (watermarks.prompts !== undefined) writeWatermark(db, "prompts", watermarks.prompts);
  if (watermarks.invocations !== undefined) writeWatermark(db, "invocations", watermarks.invocations);
  if (watermarks.execution_facts !== undefined) writeWatermark(db, "execution_facts", watermarks.execution_facts);
  if (watermarks.evolution_evidence !== undefined) writeWatermark(db, "evolution_evidence", watermarks.evolution_evidence);
}

// ---------------------------------------------------------------------------
// prepareUploads -- read new rows, build V2 payload, enqueue it
// ---------------------------------------------------------------------------

/**
 * Read new rows since watermark from SQLite, build a single V2 push
 * payload, and enqueue it into the upload queue. Never throws.
 */
export function prepareUploads(
  db: Database,
  _userId: string,
  _agentType: string,
  _selftuneVersion: string,
): PrepareResult {
  const result: PrepareResult = { enqueued: 0, types: [] };

  try {
    const watermarks = readAllWatermarks(db);
    const build = buildV2PushPayload(db, watermarks);

    if (!build) return result;

    const ok = enqueueUpload(db, "push", JSON.stringify(build.payload));
    if (ok) {
      result.enqueued = 1;
      // Report which table types had new data
      const wm = build.newWatermarks;
      if (wm.sessions !== undefined) result.types.push("sessions");
      if (wm.prompts !== undefined) result.types.push("prompts");
      if (wm.invocations !== undefined) result.types.push("invocations");
      if (wm.execution_facts !== undefined) result.types.push("execution_facts");
      if (wm.evolution_evidence !== undefined) result.types.push("evolution_evidence");

      writeAllWatermarks(db, build.newWatermarks);
    }
  } catch (err) {
    if (process.env.DEBUG || process.env.NODE_ENV === "development") {
      console.error("[alpha-upload] prepareUploads failed:", err);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// runUploadCycle -- the full cycle: prepare -> flush -> return summary
// ---------------------------------------------------------------------------

/**
 * Run a full upload cycle: read new data, enqueue it, flush to remote.
 * Guards on enrollment -- returns empty summary if not enrolled.
 * Never throws.
 */
export async function runUploadCycle(
  db: Database,
  options: UploadCycleOptions,
): Promise<UploadCycleSummary> {
  const emptySummary: UploadCycleSummary = {
    enrolled: options.enrolled,
    prepared: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  // Guard: must be enrolled
  if (!options.enrolled) {
    return emptySummary;
  }

  try {
    const userId = options.userId ?? "unknown";
    const agentType = options.agentType ?? "unknown";
    const selftuneVersion = options.selftuneVersion ?? "0.0.0";
    const endpoint =
      process.env.SELFTUNE_ALPHA_ENDPOINT ??
      options.endpoint ??
      DEFAULT_ENDPOINT;
    const dryRun = options.dryRun ?? false;
    const apiKey = options.apiKey;

    // Step 1: Prepare -- read new rows, build V2 payload, enqueue
    const prepared = prepareUploads(db, userId, agentType, selftuneVersion);

    // Step 2: Flush -- drain the queue to the remote endpoint
    const queueOps: QueueOperations = {
      getPending: (limit: number) => getPendingUploads(db, limit) as ContractQueueItem[],
      markSending: (id: number) => { markSending(db, [id]); },
      markSent: (id: number) => { markSent(db, [id]); },
      markFailed: (id: number, error?: string) => { markFailed(db, id, error ?? "unknown"); },
    };

    const flush: FlushSummary = await flushQueue(queueOps, endpoint, {
      dryRun,
      apiKey,
    });

    return {
      enrolled: true,
      prepared: prepared.enqueued,
      sent: flush.sent,
      failed: flush.failed,
      skipped: flush.skipped,
    };
  } catch (err) {
    if (process.env.DEBUG || process.env.NODE_ENV === "development") {
      console.error("[alpha-upload] runUploadCycle failed:", err);
    }
    return emptySummary;
  }
}
