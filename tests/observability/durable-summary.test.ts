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
import { compactFixture } from "./compact-fixture.js";

const batch = {
  schema_version: "1.0.0",
  batch_id: "source",
  source_revision: "r1",
  normalizer_version: "v1",
  spans: [
    {
      trace_id: "a".repeat(32),
      span_id: "b".repeat(16),
      name: "task",
      started_at: "2026-09-01T00:00:00Z",
      ended_at: "2026-09-01T00:00:01Z",
      platform: "codex",
      capture_mode: "rollout",
      source_authority: "source_truth",
      trace_boundary: "actionable_turn",
      operation_name: "invoke_agent",
      source_id: "source",
      input_tokens: 100,
      output_tokens: 50,
      error_count: 1,
      tool_call_count: 2,
    },
  ],
  links: [
    {
      link_id: "c".repeat(32),
      trace_id: "a".repeat(32),
      span_id: "b".repeat(16),
      skill_invocation_id: "invocation",
      skill_name: "test-skill",
    },
  ],
} satisfies typeof DuckDbAnalyticalBatch.Encoded;

test("discovery, recommendations and candidates survive absent detail and repeated corrections", async () => {
  const directory = mkdtempSync(join(tmpdir(), "selftune-durable-summary-"));
  let path = join(directory, "analytics.duckdb");
  const read = (input?: typeof DuckDbAnalyticalBatch.Encoded) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* DuckDbAnalyticalStore;
        if (input) yield* store.ingest(input);
        return {
          signals: yield* store.querySkillSignals(),
          tasks: yield* store.queryHistoricalSkillTaskReferences({
            skill_id: "test-skill",
            limit: 10,
          }),
          candidates: yield* store.queryEvidenceCohortCandidates({
            pattern: {
              pattern_id: "pattern",
              kind: "repeated_correlated_errors",
              skill_id: "test-skill",
              skill_name: "test-skill",
            },
          }),
        };
      }).pipe(Effect.provide(makeDuckDbNodeApiAnalyticalStoreLive(path)), Effect.scoped),
    );
  try {
    const before = await read(batch);
    expect(before.signals[0]?.input_tokens).toBe(100);
    const db = await DuckDBInstance.create(path);
    const connection = await db.connect();
    try {
      await connection.run("DELETE FROM observability_spans");
      await connection.run("DELETE FROM observability_metrics");
    } finally {
      connection.closeSync();
      db.closeSync();
    }
    expect(await read()).toEqual(before);
    const compactedPath = join(directory, "compacted.duckdb");
    const allocation = await compactFixture(path, compactedPath);
    expect(allocation.compacted).toBeLessThan(allocation.original);
    path = compactedPath;
    expect(await read()).toEqual(before);
    expect(await read(batch)).toEqual(before);
    let warmedBytes = 0;
    for (let revision = 2; revision <= 40; revision++) {
      const result = await read({
        ...batch,
        source_revision: `r${revision}`,
        spans: [{ ...batch.spans[0], input_tokens: revision }],
      });
      expect(result.signals[0]?.input_tokens).toBe(revision);
      expect(result.signals[0]?.invocation_count).toBe(1);
      expect(result.tasks[0]?.source_revision).toBe(`r${revision}`);
      if (revision === 10) warmedBytes = statSync(path).blocks * 512;
    }
    const allocatedBytes = statSync(path).blocks * 512;
    console.info("durable-summary fixture allocated bytes", {
      after10: warmedBytes,
      after40: allocatedBytes,
    });
    expect(allocatedBytes).toBeLessThan(32 * 1024 * 1024);
    expect(allocatedBytes - warmedBytes).toBeLessThan(8 * 1024 * 1024);
    const removed = await read({ ...batch, source_revision: "r41", spans: [], links: [] });
    expect(removed).toEqual({ signals: [], tasks: [], candidates: [] });
    expect(await read()).toEqual(removed);
  } finally {
    rmSync(directory, { recursive: true });
  }
}, 30_000);
