/**
 * Alpha upload contract types.
 *
 * Defines the envelope format for uploading anonymized telemetry
 * to the selftune cloud, plus the result type returned by the API.
 */

// ---------------------------------------------------------------------------
// Upload envelope — the payload POSTed to the cloud endpoint
// ---------------------------------------------------------------------------

/** Discriminated payload types that can be uploaded. */
export type AlphaPayloadType =
  | "session_telemetry"
  | "skill_usage"
  | "grading_result"
  | "evolution_evidence";

/** A single upload envelope wrapping one telemetry record. */
export interface AlphaUploadEnvelope {
  /** Unique envelope ID (UUID v4). */
  envelope_id: string;
  /** What kind of payload this envelope carries. */
  payload_type: AlphaPayloadType;
  /** ISO-8601 timestamp when the envelope was created. */
  created_at: string;
  /** Selftune CLI version that produced this envelope. */
  selftune_version: string;
  /** Anonymized contributor identity (hash). */
  contributor_id: string;
  /** The actual telemetry payload (JSON-serializable). */
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Upload result — returned by the cloud API
// ---------------------------------------------------------------------------

/** Result of attempting to upload a single envelope. */
export interface AlphaUploadResult {
  /** Whether the upload succeeded. */
  ok: boolean;
  /** The envelope ID that was uploaded. */
  envelope_id: string;
  /** HTTP status code (0 if network error prevented a response). */
  status: number;
  /** Human-readable error message on failure, undefined on success. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Queue item — represents a row in the local upload queue
// ---------------------------------------------------------------------------

/** Status of a queue item through its lifecycle. */
export type QueueItemStatus = "pending" | "sending" | "sent" | "failed";

/** A single item in the local upload queue (mirrors the DB row). */
export interface QueueItem {
  /** Auto-increment row ID. */
  id: number;
  /** The envelope ID (matches AlphaUploadEnvelope.envelope_id). */
  envelope_id: string;
  /** Payload type for grouping. */
  payload_type: AlphaPayloadType;
  /** Current queue status. */
  status: QueueItemStatus;
  /** Number of upload attempts so far. */
  attempts: number;
  /** ISO-8601 timestamp of last attempt (null if never attempted). */
  last_attempt_at: string | null;
  /** ISO-8601 timestamp when the item was enqueued. */
  created_at: string;
  /** The serialized envelope JSON. */
  envelope_json: string;
}

// ---------------------------------------------------------------------------
// Flush summary — returned by the flush engine
// ---------------------------------------------------------------------------

/** Summary of a flush run. */
export interface FlushSummary {
  /** Number of items successfully uploaded. */
  sent: number;
  /** Number of items that failed (including items that exceeded max retries). */
  failed: number;
  /** Number of items skipped (e.g., already at max attempts). */
  skipped: number;
}

// ---------------------------------------------------------------------------
// Queue operations interface — what the flush engine needs from the queue
// ---------------------------------------------------------------------------

/** Interface the flush engine requires from the queue module. */
export interface QueueOperations {
  /** Get pending items up to the given limit. */
  getPending(limit: number): QueueItem[];
  /** Mark an item as 'sending'. */
  markSending(id: number): void;
  /** Mark an item as 'sent' (upload succeeded). */
  markSent(id: number): void;
  /** Mark an item as 'failed' with incremented attempt count. */
  markFailed(id: number): void;
}
