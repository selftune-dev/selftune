import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import {
  DuckDbAnalyticalStore,
  type DuckDbAnalyticalBatch,
} from "@selftune/observability/duckdb-store";
import { makeDuckDbNodeApiAnalyticalStoreLive } from "@selftune/observability/duckdb-node-api";
import * as Effect from "effect/Effect";
import { makeDuckDbTraceEvidenceReader } from "@selftune/observability/reader-parity";
import { compactFixture } from "./compact-fixture.js";

function pointBatch(id: string, trace: string, time: string, value: number) {
  return {
    schema_version: "1.0.0",
    batch_id: id,
    source_revision: "r1",
    normalizer_version: "fixture-v1",
    spans: [],
    links: [],
    metric_points: [
      {
        metric_id: `metric-${id}`,
        trace_id: trace.repeat(32),
        observed_at: time,
        name: "input_tokens",
        value,
        unit: "count",
        temporality: "cumulative",
        evidence_quality: "source_exact",
        source_kind: "codex",
        source_id: id,
        source_reference: `fixture/${id}`,
      },
    ],
  } satisfies typeof DuckDbAnalyticalBatch.Encoded;
}

test("revising one source preserves an unrelated retained summary after restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "selftune-rollup-isolation-"));
  let path = join(directory, "observability.duckdb");
  const first = "2026-07-23T10:00:00.000Z";
  const second = "2026-07-23T11:00:00.000Z";
  const old = pointBatch("older", "a", first, 100);
  const revised = pointBatch("revised", "a", second, 200);
  const retained = pointBatch("retained", "b", first, 777);
  const ingest = (batches: ReadonlyArray<typeof DuckDbAnalyticalBatch.Encoded>) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* DuckDbAnalyticalStore;
        for (const batch of batches) yield* store.ingest(batch);
        return yield* store.queryHistoricalMetricRollups({ limit: 10 });
      }).pipe(Effect.provide(makeDuckDbNodeApiAnalyticalStoreLive(path)), Effect.scoped),
    );
  try {
    const originalRollups = await ingest([old, revised, retained]);
    const fixture = await DuckDBInstance.create(path);
    const connection = await fixture.connect();
    try {
      const reader = makeDuckDbTraceEvidenceReader(
        {
          run: (sql, parameters) => connection.run(sql, parameters),
          closeSync: () => connection.closeSync(),
          appendRows: async () => {
            throw new Error("Evidence reader must not append rows");
          },
        },
        "current",
      );
      const evidenceBefore = await reader.readPage({ limit: 10 });
      expect(evidenceBefore.items).toHaveLength(3);
      // Synthetic future-eviction condition only. Production has no eviction API.
      await connection.run(
        "DELETE FROM observability_historical_metric_points WHERE batch_id IN ('retained', 'older')",
      );
      const evidenceAfter = await reader.readPage({ limit: 10 });
      expect(evidenceAfter.items).toHaveLength(1);
      expect(evidenceAfter.items).not.toEqual(evidenceBefore.items);
    } finally {
      connection.closeSync();
      fixture.closeSync();
    }
    // Rollup parity is insufficient: the point-evidence reader above lost two facts.
    expect(await ingest([])).toEqual(originalRollups);
    const compactedPath = join(directory, "compacted.duckdb");
    await compactFixture(path, compactedPath);
    path = compactedPath;
    expect(await ingest([])).toEqual(originalRollups);
    const correction = { ...revised, source_revision: "r2", metric_points: [] };
    const result = await ingest([correction]);
    expect(result.items.map(({ source_id, value }) => ({ source_id, value }))).toEqual([
      { source_id: "older", value: 100 },
      { source_id: "retained", value: 777 },
    ]);
    expect((await ingest([correction])).items).toEqual(result.items);
    await expect(
      ingest([
        {
          ...revised,
          source_revision: "conflicting-r3",
          metric_points: [old.metric_points[0], old.metric_points[0]],
        },
      ]),
    ).rejects.toThrow();
    expect((await ingest([])).items).toEqual(result.items);
    const moved = pointBatch("revised", "c", second, 55);
    expect(
      (await ingest([{ ...moved, source_revision: "r3" }])).items.map(({ value }) => value),
    ).toEqual([100, 777, 55]);
    // The fixture must remain small, not silently become a disk stress test.
    expect(statSync(path).blocks * 512).toBeLessThan(32 * 1024 * 1024);
  } finally {
    rmSync(directory, { recursive: true });
  }
});
