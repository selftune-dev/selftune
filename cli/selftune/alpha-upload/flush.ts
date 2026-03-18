/**
 * Alpha upload flush engine.
 *
 * Drains the local upload queue by reading pending items, uploading
 * them via the HTTP client, and updating their status. Implements
 * retry with exponential backoff for transient (5xx/network) failures.
 * Client errors (4xx) are not retried.
 */

import type {
  AlphaUploadEnvelope,
  FlushSummary,
  QueueItem,
  QueueOperations,
} from "../alpha-upload-contract.js";
import { uploadEnvelope } from "./client.js";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for the flush engine. */
export interface FlushOptions {
  /** Maximum number of items to read per flush batch (default: 50). */
  batchSize?: number;
  /** Maximum upload attempts per item before marking permanently failed (default: 5). */
  maxRetries?: number;
  /** When true, log what would be sent without making HTTP calls (default: false). */
  dryRun?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 16_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true for HTTP status codes that are transient and worth retrying. */
function isRetryable(status: number): boolean {
  // 0 = network error, 5xx = server error — both are transient
  // 4xx = client error — not retryable (our payload is bad)
  // 429 = rate limited — treat as retryable
  return status === 0 || status === 429 || status >= 500;
}

/** Sleep for the given number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Calculate exponential backoff with cap. */
function backoffMs(attempt: number): number {
  const ms = INITIAL_BACKOFF_MS * 2 ** attempt;
  return Math.min(ms, MAX_BACKOFF_MS);
}

// ---------------------------------------------------------------------------
// Flush engine
// ---------------------------------------------------------------------------

/**
 * Flush the upload queue — read pending items, upload them, update status.
 *
 * @param queue - Queue operations interface (reads/writes queue items)
 * @param endpoint - Cloud API endpoint URL
 * @param options - Flush configuration
 * @returns Summary of items sent, failed, and skipped
 */
export async function flushQueue(
  queue: QueueOperations,
  endpoint: string,
  options?: FlushOptions,
): Promise<FlushSummary> {
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const dryRun = options?.dryRun ?? false;

  const summary: FlushSummary = { sent: 0, failed: 0, skipped: 0 };

  // Read a batch of pending items from the queue
  const items = queue.getPending(batchSize);

  if (items.length === 0) {
    return summary;
  }

  for (const item of items) {
    // Skip items that have already exhausted their retry budget
    if (item.attempts >= maxRetries) {
      summary.skipped++;
      continue;
    }

    // Dry-run mode: count as skipped, don't touch the queue or make HTTP calls
    if (dryRun) {
      summary.skipped++;
      continue;
    }

    // Parse the envelope from the stored JSON
    let envelope: AlphaUploadEnvelope;
    try {
      envelope = JSON.parse(item.envelope_json) as AlphaUploadEnvelope;
    } catch {
      // Corrupt envelope — mark failed permanently, don't retry
      queue.markFailed(item.id);
      summary.failed++;
      continue;
    }

    // Mark as sending (in-flight)
    queue.markSending(item.id);

    // Attempt upload with retries for transient failures
    let succeeded = false;
    const attemptsRemaining = maxRetries - item.attempts;

    for (let attempt = 0; attempt < attemptsRemaining; attempt++) {
      // Backoff before retry (not before first attempt)
      if (attempt > 0) {
        await sleep(backoffMs(attempt - 1));
      }

      const result = await uploadEnvelope(envelope, endpoint);

      if (result.ok) {
        queue.markSent(item.id);
        summary.sent++;
        succeeded = true;
        break;
      }

      // Non-retryable error — fail immediately, no more attempts
      if (!isRetryable(result.status)) {
        queue.markFailed(item.id);
        summary.failed++;
        succeeded = true; // "handled" — don't fall through to the post-loop failure path
        break;
      }

      // Transient error — continue retry loop
    }

    // Exhausted all retries without success
    if (!succeeded) {
      queue.markFailed(item.id);
      summary.failed++;
    }
  }

  return summary;
}
