import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  utimesSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { _setTestDb, getDb, openDb } from "@selftune/local-store";
import {
  DuckDbAnalyticalStore,
  type DuckDbAnalyticalStoreService,
} from "@selftune/observability/duckdb-store";
import {
  LocalTraceImportFailure,
  LocalTraceImporter,
} from "@selftune/observability/local-trace-importer";
import { makeLocalTraceImporterLive } from "@selftune/orchestration/sync/local-trace-importer";
import { makeDuckDbNodeApiAnalyticalStoreLive } from "@selftune/observability/duckdb-node-api";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

let temporaryRoot = "";
let markerPath = "";
let codexHome = "";
let analyticalPath = "";
let sync: (typeof import("@selftune/harness-codex/source-sync"))["codexSourceAdapter"]["sync"];

beforeAll(async () => {
  temporaryRoot = mkdtempSync(join(tmpdir(), "selftune-codex-source-sync-analytics-"));
  markerPath = join(temporaryRoot, "codex-marker.json");
  codexHome = join(temporaryRoot, "codex");
  analyticalPath = join(temporaryRoot, "observability.duckdb");
  const { makeCodexSourceAdapter } = await import("@selftune/harness-codex/source-sync");
  sync = makeCodexSourceAdapter(markerPath).sync;
});

beforeEach(() => {
  _setTestDb(openDb(":memory:"));
  rmSync(markerPath, { force: true });
  rmSync(analyticalPath, { force: true });
  rmSync(codexHome, { recursive: true, force: true });
});

afterEach(() => {
  _setTestDb(null);
});

afterAll(() => {
  rmSync(temporaryRoot, { recursive: true, force: true });
});

function writeRollout(multiTurn = false): string {
  const rolloutPath = join(codexHome, "sessions", "2026", "07", "23", "rollout-source-sync.jsonl");
  mkdirSync(join(rolloutPath, ".."), { recursive: true });
  writeFileSync(
    rolloutPath,
    [
      JSON.stringify({
        type: "session_meta",
        timestamp: "2026-07-23T10:00:00.000Z",
        payload: {
          id: "codex-source-sync-session",
          cwd: temporaryRoot,
          instructions:
            "### Available skills\n- diagnose: Diagnose failures.\n### How to use skills",
        },
      }),
      JSON.stringify({
        type: "turn_context",
        timestamp: "2026-07-23T10:00:01.000Z",
        payload: { model: "gpt-5" },
      }),
      JSON.stringify({
        type: "event_msg",
        timestamp: "2026-07-23T10:00:02.000Z",
        payload: { type: "user_message", message: "Diagnose this source-sync failure" },
      }),
      JSON.stringify({
        type: "response_item",
        timestamp: "2026-07-23T10:00:03.000Z",
        payload: {
          type: "function_call",
          name: "exec_command",
          arguments: '{"cmd":"cat .agents/skills/diagnose/SKILL.md"}',
        },
      }),
      JSON.stringify({
        type: "event_msg",
        timestamp: "2026-07-23T10:00:04.000Z",
        payload: { type: "usage", token_count: { input_tokens: 120, output_tokens: 30 } },
      }),
      JSON.stringify({
        type: "turn.failed",
        timestamp: "2026-07-23T10:00:05.000Z",
        error: { message: "fixture failure" },
      }),
      ...(multiTurn
        ? [
            JSON.stringify({
              type: "turn_context",
              timestamp: "2026-07-23T10:01:00.000Z",
              payload: { model: "gpt-5" },
            }),
            JSON.stringify({
              type: "event_msg",
              timestamp: "2026-07-23T10:01:01.000Z",
              payload: { type: "user_message", message: "Diagnose the next failure" },
            }),
            JSON.stringify({
              type: "event_msg",
              timestamp: "2026-07-23T10:01:02.000Z",
              payload: { type: "usage", token_count: { input_tokens: 10, output_tokens: 5 } },
            }),
          ]
        : []),
    ].join("\n"),
    "utf8",
  );
  return rolloutPath;
}

function runSync<E>(
  layer: Layer.Layer<LocalTraceImporter, E, never>,
  dryRun = false,
  onProgress?: (message: string) => void,
) {
  return Effect.runPromise(
    sync(
      {
        sourceRoot: codexHome,
        dryRun,
        force: false,
        skillLogPath: join(temporaryRoot, "skill-usage.jsonl"),
      },
      onProgress,
    ).pipe(Effect.provide(layer), Effect.scoped),
  );
}

function queryDuckDb<T, E>(
  query: (store: DuckDbAnalyticalStoreService) => Effect.Effect<T, E>,
): Promise<T> {
  return Effect.runPromise(
    Effect.gen(function* () {
      return yield* query(yield* DuckDbAnalyticalStore);
    }).pipe(Effect.provide(makeDuckDbNodeApiAnalyticalStoreLive(analyticalPath)), Effect.scoped),
  );
}

const failingAnalyticalLayer = Layer.succeed(
  LocalTraceImporter,
  LocalTraceImporter.of({
    importTrace: () =>
      Effect.fail(
        LocalTraceImportFailure.make({
          operation: "fixture analytical import",
          message: "DuckDB is unavailable",
        }),
      ),
  }),
);

test("source sync commits a Codex rollout to SQLite and DuckDB before advancing its replay marker", async () => {
  const rolloutPath = writeRollout();
  const liveLayer = Layer.provide(
    makeLocalTraceImporterLive(getDb()),
    makeDuckDbNodeApiAnalyticalStoreLive(analyticalPath),
  );

  await expect(runSync(failingAnalyticalLayer, true)).resolves.toMatchObject({
    available: true,
    scanned: 1,
    synced: 1,
  });
  expect(existsSync(markerPath)).toBe(false);
  expect(existsSync(analyticalPath)).toBe(false);
  expect(getDb().query("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 0 });

  await expect(runSync(failingAnalyticalLayer)).rejects.toMatchObject({
    _tag: "HarnessSourceSyncFailure",
    adapter_id: "codex",
    operation: "import Codex analytical trace",
  });
  expect(existsSync(markerPath)).toBe(false);

  const progress: string[] = [];
  await expect(
    runSync(liveLayer, false, (message) => progress.push(message)),
  ).resolves.toMatchObject({
    available: true,
    scanned: 1,
    synced: 1,
    skipped: 0,
    authoritativeFiles: [rolloutPath],
  });
  expect(progress).toContain("processed 1/1 Codex rollouts");
  const [reference] = await queryDuckDb((store) =>
    store.queryHistoricalSkillTaskReferences({ skill_id: "diagnose", limit: 1 }),
  );
  if (!reference) throw new Error("fixture discovery reference missing");
  expect(
    await queryDuckDb((store) =>
      store.resolveSourceTask({
        ...reference,
        skill_revision: "not-captured",
        pin_id: "sync-proof-test",
        replay: async () => {
          throw new Error("Unknown historical revision must not read source bytes");
        },
      }),
    ),
  ).toEqual({ state: "unavailable", reason: "unverified_skill_revision" });

  expect(getDb().query("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 1 });
  expect(getDb().query("SELECT COUNT(*) AS count FROM skill_invocations").get()).toEqual({
    count: 1,
  });
  expect(JSON.parse(readFileSync(markerPath, "utf8"))).toMatchObject({
    files: { [rolloutPath]: expect.anything() },
  });
  await expect(queryDuckDb((store) => store.health())).resolves.toMatchObject({
    span_count: 1,
    metric_count: 5,
    link_count: 1,
  });

  await expect(runSync(liveLayer)).resolves.toMatchObject({
    scanned: 1,
    synced: 0,
    skipped: 0,
  });
  await expect(queryDuckDb((store) => store.health())).resolves.toMatchObject({
    span_count: 1,
    metric_count: 5,
    link_count: 1,
  });
});

test("source sync acknowledges a multi-turn Codex rollout only after its session trace is stored", async () => {
  writeRollout(true);
  const liveLayer = Layer.provide(
    makeLocalTraceImporterLive(getDb()),
    makeDuckDbNodeApiAnalyticalStoreLive(analyticalPath),
  );

  await expect(runSync(liveLayer)).resolves.toMatchObject({ synced: 1 });
  await expect(queryDuckDb((store) => store.health())).resolves.toMatchObject({
    span_count: 1,
    link_count: 1,
  });
  expect(existsSync(markerPath)).toBe(true);
});

test("same-size corrected source with restored mtime replaces analytical facts once", async () => {
  const path = writeRollout();
  const fixedTime = 1_700_000_000;
  utimesSync(path, fixedTime, fixedTime);
  const layer = Layer.provide(
    makeLocalTraceImporterLive(getDb()),
    makeDuckDbNodeApiAnalyticalStoreLive(analyticalPath),
  );
  expect((await runSync(layer)).synced).toBe(1);
  writeFileSync(
    path,
    readFileSync(path, "utf8").replace('"input_tokens":120', '"input_tokens":121'),
  );
  utimesSync(path, fixedTime, fixedTime);
  expect((await runSync(layer)).synced).toBe(1);
  const signals = await queryDuckDb((store) => store.querySkillSignals());
  expect(signals.find((item) => item.skill_name === "diagnose")?.input_tokens).toBe(121);
  expect((await runSync(layer)).synced).toBe(0);
});
