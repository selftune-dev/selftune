import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { openDb } from "@selftune/local-store";
import {
  DuckDbAnalyticalStore,
  type DuckDbAnalyticalStoreService,
  type SourceTaskRequest,
} from "@selftune/observability/duckdb-store";
import { makeDuckDbNodeApiAnalyticalStoreLive } from "@selftune/observability/duckdb-node-api";
import { sourceIdentityKey } from "@selftune/observability/source-identity";
import {
  SourceSnapshot,
  sourceDigest,
  CODEX_RECONSTRUCTION_PARSER,
} from "@selftune/observability/source-reconstruction";
import {
  LocalTraceImporter,
  LocalTraceImportRequest,
} from "@selftune/observability/local-trace-importer";
import { makeLocalTraceImporterLive } from "@selftune/orchestration/sync/local-trace-importer";
import { reconstructSourceTask } from "@selftune/orchestration/reconstruct-source-task";
import { NORMALIZER_VERSION } from "@selftune/runtime/normalization";
import { computeSkillVersionHash } from "@selftune/runtime/utils/skill-discovery";
import { parseRolloutText } from "../../../packages/harnesses/codex/src/ingestors/codex-rollout.js";
import { buildLocalTelemetryBatchFromRollout } from "../../../packages/harnesses/codex/src/ingestors/codex-trace-projection.js";
import { Effect, Layer } from "effect";
import { compactFixture } from "../../../tests/observability/compact-fixture.js";
import {
  TraceCandidatePreparation,
  executionPatternIdForSkill,
  makeTraceCandidatePreparationLayer,
} from "../src/trace-candidate-service.js";

test("production candidate preparation reconstructs missing tasks from exact originals and pins recipes", async () => {
  const directory = mkdtempSync(join(tmpdir(), "selftune-source-task-"));
  const sqlite = openDb(":memory:");
  let path = join(directory, "analytics.duckdb");
  const skillDir = join(directory, "skills", "to-issues");
  mkdirSync(skillDir, { recursive: true });
  const skillPath = join(skillDir, "SKILL.md");
  writeFileSync(
    skillPath,
    "---\nname: to-issues\ndescription: Break plans into issues.\n---\n# To Issues\nBreak plans into vertical issue slices.\n",
  );
  const revision = computeSkillVersionHash(skillPath);
  if (!revision) throw new Error("fixture skill revision unavailable");
  const storeLayer = () => makeDuckDbNodeApiAnalyticalStoreLive(path);
  const query = <A, E>(run: (store: DuckDbAnalyticalStoreService) => Effect.Effect<A, E>) =>
    Effect.runPromise(
      Effect.gen(function* () {
        return yield* run(yield* DuckDbAnalyticalStore);
      }).pipe(Effect.provide(storeLayer()), Effect.scoped),
    );
  const fixtureSql = async (statements: string[]) => {
    const db = await DuckDBInstance.create(path);
    const connection = await db.connect();
    try {
      for (const sql of statements) await connection.run(sql);
    } finally {
      connection.closeSync();
      db.closeSync();
    }
  };
  const requests: LocalTraceImportRequest[] = [];
  const sources: string[] = [];
  const tasks = [
    "Use to-issues to split the billing rollout into tracked issues",
    "Use to-issues to plan the desktop update workflow",
    "Use to-issues to decompose the skill sharing feature",
  ];
  const importRequest = (request: LocalTraceImportRequest) =>
    Effect.runPromise(
      Effect.gen(function* () {
        return yield* (yield* LocalTraceImporter).importTrace(request);
      }).pipe(
        Effect.provide(Layer.provide(makeLocalTraceImporterLive(sqlite), storeLayer())),
        Effect.scoped,
      ),
    );
  const prepare = () =>
    Effect.runPromise(
      Effect.gen(function* () {
        return yield* (yield* TraceCandidatePreparation).prepare({
          pattern_id: executionPatternIdForSkill("to-issues"),
        });
      }).pipe(
        Effect.provide(
          Layer.provide(
            makeTraceCandidatePreparationLayer({
              sqlite,
              searchDirs: [join(directory, "skills")],
              teacher: async () => {
                throw new Error("Uncalibrated evidence must not invoke a teacher");
              },
            }),
            storeLayer(),
          ),
        ),
        Effect.scoped,
      ),
    );
  try {
    for (let index = 0; index < tasks.length; index++) {
      const source = join(directory, `rollout-${index}.jsonl`);
      const session = `fixture-${index}`;
      const text = [
        {
          type: "session_meta",
          timestamp: "2026-09-01T00:00:00Z",
          payload: { id: session, cwd: directory },
        },
        {
          type: "event_msg",
          timestamp: "2026-09-01T00:00:01Z",
          payload: { type: "user_message", message: tasks[index] },
        },
        {
          type: "turn.completed",
          timestamp: "2026-09-01T00:00:02Z",
          usage: { input_tokens: 100, output_tokens: 20 },
        },
      ]
        .map((item) => JSON.stringify(item))
        .join("\n");
      writeFileSync(source, text);
      sources.push(source);
      const parsed = parseRolloutText(source, text, new Set(["to-issues"]), () => new Set());
      const batch = parsed && buildLocalTelemetryBatchFromRollout(parsed);
      const link = batch?.links?.[0];
      if (!parsed || !batch || !link) throw new Error("fixture must produce a linked trace");
      sqlite.run(
        "INSERT INTO sessions (session_id, platform, capture_mode) VALUES (?, 'codex', 'rollout')",
        [session],
      );
      sqlite.run(
        `INSERT INTO skill_invocations (skill_invocation_id, session_id, skill_name, skill_version_hash,
        skill_path, invocation_mode, triggered, source, platform, capture_mode)
        VALUES (?, ?, 'to-issues', ?, ?, 'explicit', 1, 'codex_rollout', 'codex', 'rollout')`,
        [link.skill_invocation_id, session, revision, skillPath],
      );
      const snapshot = SourceSnapshot.make({
        parser: CODEX_RECONSTRUCTION_PARSER,
        path: source,
        sha256: sourceDigest(Buffer.from(text)),
        bytes: Buffer.byteLength(text),
        skill_names: ["to-issues"],
        task_sha256: sourceDigest(Buffer.from(parsed.query)),
        workspace_skills: [{ cwd: directory, names: [] }],
      });
      const request = LocalTraceImportRequest.make({
        source_kind: "codex",
        source_session_ids: [session],
        source_revision: snapshot.sha256,
        normalizer_version: NORMALIZER_VERSION,
        source_snapshot: snapshot,
        batch,
      });
      requests.push(request);
      await importRequest(request);
    }
    await fixtureSql([
      "DELETE FROM observability_spans",
      "DELETE FROM observability_metrics",
      "UPDATE observability_source_reconstruction SET detail_state = 'evicted'",
    ]);
    const result = await prepare();
    expect(result.evidence.resolved_entries).toBe(3);
    expect(result.failure_reason).toContain("neutral until");
    expect((await query((store) => store.health())).span_count).toBe(0);
    const first = requests[0];
    const link = first.batch.links?.[0];
    if (!link) throw new Error("fixture link missing");
    const read: SourceTaskRequest = {
      ...link,
      source_revision: first.source_revision,
      skill_revision: revision,
      pin_id: "exact-fixture-pin",
      replay: reconstructSourceTask,
    };
    expect(await query((store) => store.resolveSourceTask(read))).toMatchObject({
      state: "available",
      task: tasks[0],
    });
    const beforeCompaction = await prepare();
    const originalDigests = sources.map((source) => sourceDigest(readFileSync(source)));
    const compactedPath = join(directory, "compacted.duckdb");
    await compactFixture(path, compactedPath);
    path = compactedPath;
    expect(await prepare()).toEqual(beforeCompaction);
    expect(await query((store) => store.resolveSourceTask(read))).toMatchObject({
      state: "available",
      task: tasks[0],
    });
    expect(sources.map((source) => sourceDigest(readFileSync(source)))).toEqual(originalDigests);
    const allocated = statSync(path).blocks * 512;
    for (let retry = 0; retry < 10; retry++) {
      await importRequest(first);
      expect(await query((store) => store.resolveSourceTask(read))).toMatchObject({
        state: "available",
      });
    }
    expect((await query((store) => store.health())).span_count).toBe(0);
    console.info("source-reconstruction fixture allocated bytes", {
      beforeRetries: allocated,
      after10Retries: statSync(path).blocks * 512,
    });
    expect(statSync(path).blocks * 512 - allocated).toBeLessThan(4 * 1024 * 1024);
    expect(statSync(path).blocks * 512).toBeLessThan(32 * 1024 * 1024);
    expect(
      await query((store) => store.resolveSourceTask({ ...read, skill_revision: "different" })),
    ).toEqual({ state: "unavailable", reason: "unverified_skill_revision" });
    expect(
      await query((store) =>
        store.resolveSourceTask({
          ...read,
          replay: async (input) => {
            const replayed = await reconstructSourceTask(input);
            return replayed.state === "reconstructed"
              ? { ...replayed, batch: { ...replayed.batch, links: [] } }
              : replayed;
          },
        }),
      ),
    ).toEqual({ state: "unavailable", reason: "projection_changed" });
    const original = readFileSync(sources[0]);
    writeFileSync(sources[0], "changed original");
    expect((await prepare()).failure_reason).toContain("source_changed");
    rmSync(sources[0]);
    expect(await query((store) => store.resolveSourceTask(read))).toEqual({
      state: "unavailable",
      reason: "source_missing",
    });
    writeFileSync(sources[0], original);
    await importRequest({
      ...first,
      source_revision: "revised",
      normalizer_version: NORMALIZER_VERSION,
    });
    // Pin still names the old exact recipe; updating discovery does not silently retarget it.
    expect(await query((store) => store.resolveSourceTask(read))).toMatchObject({
      state: "available",
      task: tasks[0],
    });
    expect((await query((store) => store.health())).span_count).toBe(0);
    expect(
      await query((store) =>
        store.resolveSourceTask({ ...read, trace_id: "f".repeat(32), pin_id: "missing-source" }),
      ),
    ).toEqual({ state: "unavailable", reason: "missing" });
    const started = Promise.withResolvers<void>();
    const unblock = Promise.withResolvers<void>();
    const controller = new AbortController();
    const interrupted = Effect.runPromiseExit(
      Effect.gen(function* () {
        return yield* (yield* DuckDbAnalyticalStore).resolveSourceTask({
          ...read,
          source_revision: "revised",
          pin_id: "interrupted",
          replay: async (input) => {
            started.resolve();
            await unblock.promise;
            return reconstructSourceTask(input);
          },
        });
      }).pipe(Effect.provide(storeLayer()), Effect.scoped),
      { signal: controller.signal },
    );
    await started.promise;
    controller.abort();
    expect((await interrupted)._tag).toBe("Failure");
    unblock.resolve();
    const inspection = await DuckDBInstance.create(path);
    const inspectionConnection = await inspection.connect();
    try {
      expect(
        await (
          await inspectionConnection.run(
            "SELECT pin_id FROM observability_source_evidence_pins WHERE pin_id = 'interrupted'",
          )
        ).getRowObjects(),
      ).toEqual([]);
    } finally {
      inspectionConnection.closeSync();
      inspection.closeSync();
    }
    await importRequest({
      ...first,
      source_revision: "future-normalizer",
      normalizer_version: "unsupported",
    });
    expect(
      await query((store) =>
        store.resolveSourceTask({
          ...read,
          source_revision: "future-normalizer",
          pin_id: "future-normalizer",
        }),
      ),
    ).toEqual({ state: "unavailable", reason: "normalizer_changed" });
    await fixtureSql([
      `INSERT INTO observability_expired_sources VALUES ('${sourceIdentityKey({ provider: "codex", session_id: "fixture-0" })}')`,
      "DELETE FROM observability_source_reconstruction",
    ]);
    const expiredCopy = join(directory, "expired-compacted.duckdb");
    await compactFixture(path, expiredCopy);
    path = expiredCopy;
    expect(await query((store) => store.resolveSourceTask(read))).toEqual({
      state: "unavailable",
      reason: "expired",
    });
    await expect(
      importRequest({ ...first, source_revision: "force-reimport", normalizer_version: "next" }),
    ).rejects.toThrow("cannot resurrect");
    expect((await query((store) => store.health())).span_count).toBe(0);
  } finally {
    sqlite.close();
    rmSync(directory, { recursive: true });
  }
});
