import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { Effect, Schema } from "effect";
import {
  DuckDbAnalyticalStore,
  type DuckDbAnalyticalBatch,
} from "@selftune/observability/duckdb-store";
import { makeDuckDbNodeApiAnalyticalStoreLive } from "@selftune/observability/duckdb-node-api";

const batch = {
  schema_version: "1.0.0",
  batch_id: "revised-source",
  source_revision: "r1",
  normalizer_version: "fixture-v1",
  spans: [],
  links: [],
  metric_points: [
    {
      metric_id: "point",
      trace_id: "a".repeat(32),
      observed_at: "2026-10-01T00:00:00.000Z",
      name: "input_tokens",
      value: 100,
      unit: "count",
      temporality: "cumulative",
      evidence_quality: "source_exact",
      source_kind: "codex",
      source_id: "revised-source",
      source_reference: "fixture/source",
    },
  ],
} satisfies typeof DuckDbAnalyticalBatch.Encoded;

const Rows = Schema.Array(Schema.Struct({ row_id: Schema.String, value: Schema.Number }));
const Counts = Schema.Array(Schema.Struct({ rows: Schema.String }));

test("source-only revisions do not rewrite unchanged rollups beside retained history", async () => {
  const directory = mkdtempSync(join(tmpdir(), "selftune-rollup-writes-"));
  const path = join(directory, "observability.duckdb");
  const ingest = (input: typeof DuckDbAnalyticalBatch.Encoded) =>
    Effect.runPromise(
      Effect.gen(function* () {
        return yield* (yield* DuckDbAnalyticalStore).ingest(input);
      }).pipe(Effect.provide(makeDuckDbNodeApiAnalyticalStoreLive(path)), Effect.scoped),
    );
  const sql = async (statement: string) => {
    const db = await DuckDBInstance.create(path);
    const connection = await db.connect();
    try {
      return await (await connection.run(statement)).getRowObjects();
    } finally {
      connection.closeSync();
      db.closeSync();
    }
  };
  const target = async () =>
    Schema.decodeUnknownSync(Rows)(
      await sql(
        "SELECT CAST(rowid AS VARCHAR) AS row_id, value FROM observability_historical_metric_rollups WHERE source_id = 'revised-source'",
      ),
    );
  const count = async () =>
    Schema.decodeUnknownSync(Counts)(
      await sql(
        "SELECT CAST(COUNT(*) AS VARCHAR) AS rows FROM observability_historical_metric_rollups",
      ),
    );
  try {
    await ingest(batch);
    // Retained summaries may outlive their detail. Revisions must leave them untouched.
    await sql(`INSERT INTO observability_historical_metric_rollups
      SELECT md5('retained-' || CAST(i AS VARCHAR)), metric_name, metric_id,
        'unrelated', observed_at, value, unit, temporality, evidence_quality, source_reference
      FROM observability_historical_metric_rollups CROSS JOIN range(10000) AS neighbors(i)`);
    const before = await target();
    expect(before).toHaveLength(1);
    expect(await count()).toEqual([{ rows: "10001" }]);
    for (let revision = 2; revision <= 21; revision++) {
      await ingest({ ...batch, source_revision: `r${revision}` });
    }
    // A changed physical row identity would prove delete/reinsert amplification despite equal values.
    expect(await target()).toEqual(before);
    expect(await count()).toEqual([{ rows: "10001" }]);
    expect(statSync(path).size).toBeLessThan(32 * 1024 * 1024);
    await ingest({
      ...batch,
      source_revision: "changed-value",
      metric_points: [{ ...batch.metric_points[0], value: 101 }],
    });
    expect((await target())[0]?.value).toBe(101);
    await ingest({ ...batch, source_revision: "removed-point", metric_points: [] });
    expect(await target()).toEqual([]);
    expect(await count()).toEqual([{ rows: "10000" }]);
  } finally {
    rmSync(directory, { recursive: true });
  }
}, 30_000);
