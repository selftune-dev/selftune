import { expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDb } from "@selftune/local-store";
import { createInteractiveReportWorker } from "../src/interactive-report-worker.js";
import * as Semaphore from "effect/Semaphore";

test("overview worker preserves pagination and shares concurrent identical requests", async () => {
  const root = mkdtempSync(join(tmpdir(), "overview-worker-"));
  const dbPath = join(root, "db.sqlite");
  const db = openDb(dbPath);
  db.close();
  const worker = createInteractiveReportWorker(
    "overview",
    {
      storagePaths: {
        configRoot: root,
        localDatabasePath: dbPath,
        localAnalyticsPath: join(root, "analytics"),
      },
    },
    root,
  );
  try {
    const search = new URLSearchParams("telemetry_limit=1&skills_limit=1");
    const first = worker("fixture", search);
    const second = worker("fixture", search);
    expect((await worker("fixture", new URLSearchParams("skills_limit=2"))).status).toBe(503);
    const [a, b] = await Promise.all([first, second]);
    expect(a.status).toBe(200);
    const body = await a.json();
    expect(await b.json()).toEqual(body);
    expect(body.version).toBe("fixture");
    expect(body.overview.skills_page.items).toEqual([]);
    expect(body.overview.telemetry_page.items).toEqual([]);
    expect(readdirSync(join(root, "overview"))).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("selected skill workers retain 404 semantics and coalesce identical reads", async () => {
  const root = mkdtempSync(join(tmpdir(), "skill-report-worker-"));
  const path = join(root, "db.sqlite");
  const db = openDb(path);
  db.close();
  const worker = createInteractiveReportWorker(
    "skill-report",
    {
      storagePaths: {
        configRoot: root,
        localDatabasePath: path,
        localAnalyticsPath: join(root, "analytics"),
      },
    },
    root,
  );
  try {
    const first = worker("missing-worker-fixture", new URLSearchParams("invocations_limit=1"));
    const second = worker("missing-worker-fixture", new URLSearchParams("invocations_limit=1"));
    const [a, b] = await Promise.all([first, second]);
    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    expect(await a.json()).toEqual(await b.json());
    expect(readdirSync(join(root, "skill-report"))).toEqual([]);
  } finally {
    await worker.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("shell cache is versioned and never accepts a result changed during compute", async () => {
  const root = mkdtempSync(join(tmpdir(), "shell-worker-cache-"));
  let version = "one";
  const worker = createInteractiveReportWorker(
    "shell",
    { configRoot: root },
    root,
    {
      command: [
        process.execPath,
        join(import.meta.dir, "fixtures", "report-worker.ts"),
        "counted-shell",
      ],
    },
    () => version,
  );
  try {
    const request = () => worker("fixture", new URLSearchParams());
    expect(await (await request()).json()).toEqual({ count: 1 });
    expect(await (await request()).json()).toEqual({ count: 1 });
    version = "two";
    expect(await (await request()).json()).toEqual({ count: 2 });
    version = "three";
    const inFlight = request();
    version = "four";
    expect(await (await inFlight).json()).toEqual({ count: 3 });
    expect(await (await request()).json()).toEqual({ count: 4 });
    await worker.close();
    expect((await request()).status).toBe(503);
  } finally {
    await worker.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("worker timeout releases its slot and does not fall back to blocking computation", async () => {
  const root = mkdtempSync(join(tmpdir(), "overview-timeout-"));
  const worker = createInteractiveReportWorker("overview", { configRoot: root }, root, {
    command: [process.execPath, "-e", "setInterval(() => {}, 1000)"],
    timeoutMs: 30,
  });
  try {
    expect((await worker("test", new URLSearchParams())).status).toBe(503);
    expect((await worker("new-version", new URLSearchParams())).status).toBe(503);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("shutdown cancels a queued overview and refuses new report work", async () => {
  const root = mkdtempSync(join(tmpdir(), "overview-shutdown-"));
  const worker = createInteractiveReportWorker("overview", { configRoot: root }, root, {
    semaphore: Semaphore.makeUnsafe(0),
  });
  try {
    const response = worker("test", new URLSearchParams());
    await worker.close();
    expect((await response).status).toBe(503);
    expect((await worker("test", new URLSearchParams())).status).toBe(503);
    expect(readdirSync(root)).toEqual([]);
  } finally {
    await worker.close();
    rmSync(root, { recursive: true, force: true });
  }
});
