import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type {
  AlphaUploadEnvelope,
  AlphaUploadResult,
  FlushSummary,
  QueueItem,
  QueueOperations,
} from "../../cli/selftune/alpha-upload-contract.js";
import { uploadEnvelope } from "../../cli/selftune/alpha-upload/client.js";
import { flushQueue, type FlushOptions } from "../../cli/selftune/alpha-upload/flush.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnvelope(overrides?: Partial<AlphaUploadEnvelope>): AlphaUploadEnvelope {
  return {
    envelope_id: `env-${Math.random().toString(36).slice(2, 8)}`,
    payload_type: "session_telemetry",
    created_at: new Date().toISOString(),
    selftune_version: "0.2.7",
    contributor_id: "test-contributor",
    payload: { foo: "bar" },
    ...overrides,
  };
}

function makeQueueItem(id: number, overrides?: Partial<QueueItem>): QueueItem {
  const envelope = makeEnvelope(overrides?.envelope_id ? { envelope_id: overrides.envelope_id } : undefined);
  return {
    id,
    envelope_id: envelope.envelope_id,
    payload_type: "session_telemetry",
    status: "pending",
    attempts: 0,
    last_attempt_at: null,
    created_at: new Date().toISOString(),
    envelope_json: JSON.stringify(envelope),
    ...overrides,
  };
}

function createMockQueue(items: QueueItem[]): QueueOperations & { calls: Record<string, number[][]> } {
  const calls: Record<string, number[][]> = {
    getPending: [],
    markSending: [],
    markSent: [],
    markFailed: [],
  };

  let pendingItems = [...items];

  return {
    calls,
    getPending(limit: number): QueueItem[] {
      calls.getPending.push([limit]);
      const result = pendingItems.filter((i) => i.status === "pending").slice(0, limit);
      // After returning items, simulate they won't appear again in subsequent calls
      pendingItems = pendingItems.filter((i) => !result.some((r) => r.id === i.id));
      return result;
    },
    markSending(id: number): void {
      calls.markSending.push([id]);
    },
    markSent(id: number): void {
      calls.markSent.push([id]);
    },
    markFailed(id: number): void {
      calls.markFailed.push([id]);
    },
  };
}

// ---------------------------------------------------------------------------
// uploadEnvelope tests
// ---------------------------------------------------------------------------

describe("uploadEnvelope", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("returns ok result on 200 response", async () => {
    const envelope = makeEnvelope();
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const result = await uploadEnvelope(envelope, "https://api.example.com/upload");

    expect(result.ok).toBe(true);
    expect(result.envelope_id).toBe(envelope.envelope_id);
    expect(result.status).toBe(200);
    expect(result.error).toBeUndefined();
  });

  test("sends correct headers", async () => {
    const envelope = makeEnvelope();
    let capturedHeaders: Headers | null = null;

    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    await uploadEnvelope(envelope, "https://api.example.com/upload");

    expect(capturedHeaders).not.toBeNull();
    expect(capturedHeaders!.get("Content-Type")).toBe("application/json");
    expect(capturedHeaders!.get("User-Agent")).toMatch(/^selftune\//);
  });

  test("sends POST with JSON body", async () => {
    const envelope = makeEnvelope();
    let capturedMethod: string | undefined;
    let capturedBody: string | undefined;

    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedMethod = init?.method;
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    await uploadEnvelope(envelope, "https://api.example.com/upload");

    expect(capturedMethod).toBe("POST");
    const parsed = JSON.parse(capturedBody!);
    expect(parsed.envelope_id).toBe(envelope.envelope_id);
  });

  test("returns error result on 4xx response", async () => {
    const envelope = makeEnvelope();
    globalThis.fetch = mock(async () =>
      new Response("Bad Request", { status: 400 }),
    );

    const result = await uploadEnvelope(envelope, "https://api.example.com/upload");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBeDefined();
  });

  test("returns error result on 5xx response", async () => {
    const envelope = makeEnvelope();
    globalThis.fetch = mock(async () =>
      new Response("Internal Server Error", { status: 500 }),
    );

    const result = await uploadEnvelope(envelope, "https://api.example.com/upload");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBeDefined();
  });

  test("returns error result on network failure without throwing", async () => {
    const envelope = makeEnvelope();
    globalThis.fetch = mock(async () => {
      throw new Error("Network unreachable");
    });

    const result = await uploadEnvelope(envelope, "https://api.example.com/upload");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.error).toContain("Network unreachable");
  });
});

// ---------------------------------------------------------------------------
// flushQueue tests
// ---------------------------------------------------------------------------

describe("flushQueue", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("returns zero summary when queue is empty", async () => {
    const queue = createMockQueue([]);

    const summary = await flushQueue(queue, "https://api.example.com/upload");

    expect(summary).toEqual({ sent: 0, failed: 0, skipped: 0 });
  });

  test("uploads all pending items on success", async () => {
    const items = [makeQueueItem(1), makeQueueItem(2), makeQueueItem(3)];
    const queue = createMockQueue(items);

    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const summary = await flushQueue(queue, "https://api.example.com/upload");

    expect(summary.sent).toBe(3);
    expect(summary.failed).toBe(0);
    expect(summary.skipped).toBe(0);
    // Each item should be marked sending then sent
    expect(queue.calls.markSending.length).toBe(3);
    expect(queue.calls.markSent.length).toBe(3);
  });

  test("marks items as failed when upload fails", async () => {
    const items = [makeQueueItem(1)];
    const queue = createMockQueue(items);

    globalThis.fetch = mock(async () =>
      new Response("Server Error", { status: 500 }),
    );

    const summary = await flushQueue(queue, "https://api.example.com/upload", {
      maxRetries: 1,
    });

    expect(summary.failed).toBe(1);
    expect(summary.sent).toBe(0);
    expect(queue.calls.markFailed.length).toBeGreaterThanOrEqual(1);
  });

  test("skips items that already exceeded max attempts", async () => {
    const items = [
      makeQueueItem(1, { attempts: 5 }),
    ];
    const queue = createMockQueue(items);

    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const summary = await flushQueue(queue, "https://api.example.com/upload", {
      maxRetries: 5,
    });

    expect(summary.skipped).toBe(1);
    expect(summary.sent).toBe(0);
    expect(queue.calls.markSending.length).toBe(0);
  });

  test("handles partial failure — some succeed, some fail", async () => {
    const items = [
      makeQueueItem(1, { envelope_id: "good-1" }),
      makeQueueItem(2, { envelope_id: "bad-1" }),
      makeQueueItem(3, { envelope_id: "good-2" }),
    ];
    const queue = createMockQueue(items);

    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      if (body.envelope_id === "bad-1") {
        return new Response("Server Error", { status: 500 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const summary = await flushQueue(queue, "https://api.example.com/upload", {
      maxRetries: 1,
    });

    expect(summary.sent).toBe(2);
    expect(summary.failed).toBe(1);
  });

  test("respects batchSize option", async () => {
    const items = [makeQueueItem(1), makeQueueItem(2), makeQueueItem(3)];
    const queue = createMockQueue(items);

    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await flushQueue(queue, "https://api.example.com/upload", {
      batchSize: 2,
    });

    // getPending should have been called with limit 2
    expect(queue.calls.getPending[0]![0]).toBe(2);
  });

  test("dry-run mode does not make HTTP calls", async () => {
    const items = [makeQueueItem(1), makeQueueItem(2)];
    const queue = createMockQueue(items);
    let fetchCallCount = 0;

    globalThis.fetch = mock(async () => {
      fetchCallCount++;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const summary = await flushQueue(queue, "https://api.example.com/upload", {
      dryRun: true,
    });

    expect(fetchCallCount).toBe(0);
    // Dry run should still report what would have been sent
    expect(summary.sent).toBe(0);
    expect(summary.skipped).toBe(2);
    // Should NOT mark any items as sent or failed
    expect(queue.calls.markSent.length).toBe(0);
    expect(queue.calls.markFailed.length).toBe(0);
  });

  test("retries with backoff on transient failure then succeeds", async () => {
    const items = [makeQueueItem(1)];
    const queue = createMockQueue(items);
    let callCount = 0;

    globalThis.fetch = mock(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response("Server Error", { status: 500 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const summary = await flushQueue(queue, "https://api.example.com/upload", {
      maxRetries: 3,
    });

    expect(summary.sent).toBe(1);
    expect(summary.failed).toBe(0);
    expect(callCount).toBe(2);
  });

  test("does not retry on 4xx client errors", async () => {
    const items = [makeQueueItem(1)];
    const queue = createMockQueue(items);
    let callCount = 0;

    globalThis.fetch = mock(async () => {
      callCount++;
      return new Response("Bad Request", { status: 400 });
    });

    const summary = await flushQueue(queue, "https://api.example.com/upload", {
      maxRetries: 3,
    });

    expect(summary.failed).toBe(1);
    // Should NOT retry on 4xx — only one call
    expect(callCount).toBe(1);
  });
});
