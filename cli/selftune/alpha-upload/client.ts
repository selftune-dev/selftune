/**
 * Alpha upload HTTP client.
 *
 * POSTs AlphaUploadEnvelope payloads to the cloud endpoint.
 * Uses native fetch (Bun built-in). Never throws — returns
 * an AlphaUploadResult indicating success or failure.
 */

import type { AlphaUploadEnvelope, AlphaUploadResult } from "../alpha-upload-contract.js";

/** Selftune version for the User-Agent header. */
const SELFTUNE_VERSION = "0.2.7";

/**
 * Upload a single envelope to the given endpoint.
 *
 * Returns a typed result. Never throws — network errors and HTTP
 * failures are captured in the result's `ok`, `status`, and `error` fields.
 */
export async function uploadEnvelope(
  envelope: AlphaUploadEnvelope,
  endpoint: string,
): Promise<AlphaUploadResult> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `selftune/${SELFTUNE_VERSION}`,
      },
      body: JSON.stringify(envelope),
    });

    if (response.ok) {
      return {
        ok: true,
        envelope_id: envelope.envelope_id,
        status: response.status,
      };
    }

    // Non-2xx response — read error text for diagnostics
    const errorText = await response.text().catch(() => "unknown error");
    return {
      ok: false,
      envelope_id: envelope.envelope_id,
      status: response.status,
      error: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
    };
  } catch (err) {
    // Network-level failure (DNS, timeout, connection refused, etc.)
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      envelope_id: envelope.envelope_id,
      status: 0,
      error: message,
    };
  }
}
