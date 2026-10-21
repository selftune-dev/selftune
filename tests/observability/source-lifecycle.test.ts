import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { openDb } from "@selftune/local-store";
import {
  DuckDbAnalyticalStore,
  type DuckDbAnalyticalBatch,
  type DuckDbAnalyticalStoreService,
} from "@selftune/observability/duckdb-store";
import { makeDuckDbNodeApiAnalyticalStoreLive } from "@selftune/observability/duckdb-node-api";
import { sourceIdentityKey, SourceIdentities } from "@selftune/observability/source-identity";
import { normalizeHistoricalBackfill } from "@selftune/observability/historical-backfill";
import { LocalTraceImporter } from "@selftune/observability/local-trace-importer";
import { makeLocalTraceImporterLive } from "@selftune/orchestration/sync/local-trace-importer";
import { runHistoricalBackfill } from "@selftune/orchestration/historical-backfill";
import { Effect, Layer, Schema } from "effect";

const identity = { provider: "codex", session_id: "one" } as const;
const base = {
  schema_version: "1.0.0",
  batch_id: "original",
  source_revision: "r1",
  normalizer_version: "v1",
  spans: [],
  links: [],
} satisfies typeof DuckDbAnalyticalBatch.Encoded;

test("logical source keys are provider-namespaced and request identity lists are bounded", () => {
  expect(sourceIdentityKey(identity)).toBe(
    sourceIdentityKey({ session_id: "one", provider: "codex" }),
  );
  expect(sourceIdentityKey(identity)).not.toBe(sourceIdentityKey({ ...identity, provider: "pi" }));
  expect(Schema.is(SourceIdentities)([])).toBe(false);
  expect(Schema.is(SourceIdentities)(Array.from({ length: 257 }, () => identity))).toBe(false);
});

test("exact, revised, mixed and backfilled sources cannot bypass expiration or advance checkpoints", async () => {
  const directory = mkdtempSync(join(tmpdir(), "selftune-source-lifecycle-"));
  const path = join(directory, "analytics.duckdb");
  const sqlite = openDb(":memory:");
  const storeLayer = () => makeDuckDbNodeApiAnalyticalStoreLive(path);
  const query = <A, E>(run: (store: DuckDbAnalyticalStoreService) => Effect.Effect<A, E>) =>
    Effect.runPromise(
      Effect.gen(function* () {
        return yield* run(yield* DuckDbAnalyticalStore);
      }).pipe(Effect.provide(storeLayer()), Effect.scoped),
    );
  const importerLayer = () => Layer.provide(makeLocalTraceImporterLive(sqlite), storeLayer());
  const fixtureSql = async (sql: string) => {
    const db = await DuckDBInstance.create(path);
    const connection = await db.connect();
    try {
      return await (await connection.run(sql)).getRowObjects();
    } finally {
      connection.closeSync();
      db.closeSync();
    }
  };
  try {
    await query((store) => store.ingest(base));
    const qualified = { ...base, source_identities: [identity] };
    // An old exact receipt must acquire provenance without rewriting existing detail.
    expect(await query((store) => store.hasExactBatchReceipt(qualified))).toBe(false);
    expect((await query((store) => store.ingest(qualified))).disposition).toBe("duplicate");
    expect(await query((store) => store.hasExactBatchReceipt(qualified))).toBe(true);
    await expect(
      query((store) =>
        store.ingest({ ...qualified, source_identities: [{ ...identity, session_id: "two" }] }),
      ),
    ).rejects.toThrow("cannot change");
    await expect(
      query((store) =>
        store.hasExactBatchReceipt({
          ...qualified,
          source_identities: [identity, { ...identity, session_id: "two" }],
        }),
      ),
    ).rejects.toThrow("cannot change");
    await query((store) => store.ingest({ ...qualified, source_identities: [identity, identity] }));
    await fixtureSql(
      `INSERT INTO observability_expired_sources VALUES ('${sourceIdentityKey(identity)}')`,
    );
    const before = await fixtureSql("SELECT * FROM observability_ingested_batches");
    for (const input of [
      base,
      qualified,
      { ...qualified, source_revision: "r2", normalizer_version: "v2", batch_id: "different" },
      {
        ...qualified,
        batch_id: "mixed",
        source_identities: [identity, { ...identity, session_id: "two" }],
      },
    ]) {
      await expect(query((store) => store.hasExactBatchReceipt(input))).rejects.toThrow(
        "cannot resurrect",
      );
      await expect(query((store) => store.ingest(input))).rejects.toThrow("cannot resurrect");
    }
    expect(await fixtureSql("SELECT * FROM observability_ingested_batches")).toEqual(before);
    expect(await fixtureSql("SELECT batch_id FROM observability_batch_sources")).toEqual([
      { batch_id: "original" },
    ]);
    // Native session IDs can overlap between harnesses without sharing expiration.
    await query((store) =>
      store.ingest({
        ...base,
        batch_id: "pi",
        source_identities: [{ ...identity, provider: "pi" }],
      }),
    );
    await query((store) => store.ingest({ ...base, batch_id: "legacy-expired" }));
    await fixtureSql(
      "INSERT INTO observability_source_reconstruction VALUES ('legacy-expired', 'r1', 'v1', 'unused', '{}', 'expired')",
    );
    await expect(
      query((store) => store.hasExactBatchReceipt({ ...base, batch_id: "legacy-expired" })),
    ).rejects.toThrow("cannot resurrect");
    await expect(
      query((store) => store.ingest({ ...base, batch_id: "legacy-expired" })),
    ).rejects.toThrow("cannot resurrect");
    for (const id of ["one", "two"])
      sqlite.run(
        "INSERT INTO sessions (session_id, platform, started_at, ended_at, capture_mode) VALUES (?, 'codex', '2026-09-01T00:00:00Z', '2026-09-01T00:00:01Z', 'rollout')",
        [id],
      );
    const normalize = (revision: string) =>
      Effect.runPromise(
        normalizeHistoricalBackfill({
          source_cursor: revision,
          source_revision: revision,
          source_domain: "sessions",
          include_session_spans: true,
          sessions: ["one", "two"].map((session_id) => ({
            session_id,
            platform: "codex",
            started_at: "2026-09-01T00:00:00Z",
            ended_at: "2026-09-01T00:00:01Z",
          })),
          prompts: [],
          skill_invocations: [],
          execution_facts: [],
        }),
      );
    const original = (await normalize("backfill-1")).imports[0];
    const revised = (await normalize("backfill-2")).imports[0];
    expect(original.batch.batch_id).not.toBe(revised.batch.batch_id);
    expect(original.source_session_ids).toEqual(["one", "two"]);
    expect(revised.source_session_ids).toEqual(original.source_session_ids);
    for (const request of [original, revised]) {
      await expect(
        Effect.runPromise(
          Effect.gen(function* () {
            return yield* (yield* LocalTraceImporter).importTrace(request);
          }).pipe(Effect.provide(importerLayer()), Effect.scoped),
        ),
      ).rejects.toThrow("cannot resurrect");
    }
    const allocatedBefore = statSync(path).blocks * 512;
    for (let retry = 0; retry < 10; retry++) {
      await expect(
        Effect.runPromise(
          runHistoricalBackfill(sqlite, { batchSize: 2 }).pipe(
            Effect.provide(importerLayer()),
            Effect.scoped,
          ),
        ),
      ).rejects.toThrow("cannot resurrect");
    }
    expect(
      sqlite
        .query(
          "SELECT * FROM analytical_import_checkpoints WHERE source_kind != 'historical-backfill-boundary'",
        )
        .all(),
    ).toEqual([]);
    expect((await query((store) => store.health())).span_count).toBe(0);
    const allocatedAfter = statSync(path).blocks * 512;
    console.info("source-lifecycle fixture allocated bytes", {
      beforeRetries: allocatedBefore,
      after10Retries: allocatedAfter,
    });
    expect(allocatedAfter - allocatedBefore).toBeLessThan(4 * 1024 * 1024);
    expect(allocatedAfter).toBeLessThan(16 * 1024 * 1024);
  } finally {
    sqlite.close();
    rmSync(directory, { recursive: true });
  }
});
