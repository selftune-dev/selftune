import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  statSync,
  realpathSync,
  utimesSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "@selftune/local-store";
import { createSkillRevisionHistory } from "@selftune/runtime/skill-revision-history";
import { createSkillRevisionService } from "../src/skill-revision-service";

let root: string;
let skill: string;
let db: ReturnType<typeof openDb>;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "selftune-history-"));
  skill = join(root, "skill");
  mkdirSync(skill);
  writeFileSync(join(skill, "SKILL.md"), "first");
  db = openDb(join(root, "history.db"));
});
afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});
const history = () => createSkillRevisionHistory(db, join(root, "config"));

test("background scan yields between packages and stop cancels remaining work", async () => {
  const paths = [skill];
  for (let i = 0; i < 3; i += 1) {
    const path = join(root, `skill-${i}`);
    mkdirSync(path);
    writeFileSync(join(path, "SKILL.md"), "skill");
    paths.push(path);
  }
  const service = createSkillRevisionService(db, join(root, "config"), { paths: () => paths });
  service.start();
  await new Promise<void>((resolve) => setImmediate(resolve));
  service.stop();
  const count = db
    .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM skill_local_revisions")
    .get()!.count;
  expect(count).toBeLessThan(paths.length);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(
    db.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM skill_local_revisions").get()!
      .count,
  ).toBe(count);
});

test("selected registry aliases authorize their current target and reject removed links", async () => {
  const previous = process.env.SELFTUNE_HOME;
  process.env.SELFTUNE_HOME = join(root, "home");
  const registry = join(root, "home", ".agents", "skills");
  mkdirSync(registry, { recursive: true });
  const alias = join(registry, "renamed-alias");
  symlinkSync(skill, alias, "dir");
  const service = createSkillRevisionService(db, join(root, "config"));
  const url = new URL(
    `http://localhost/api/v2/skill-history?path=${encodeURIComponent(join(alias, "SKILL.md"))}`,
  );
  try {
    const response = await service.handle(new Request(url), url, new Set());
    if (!response) throw new Error("History route did not handle the fixture");
    expect(response.status).toBe(200);
    expect((await response.json()).revisions[0].package_path).toBe(realpathSync(skill));
    rmSync(alias);
    expect((await service.handle(new Request(url), url, new Set()))?.status).toBe(400);
  } finally {
    if (previous === undefined) delete process.env.SELFTUNE_HOME;
    else process.env.SELFTUNE_HOME = previous;
  }
});

test("fingerprint cache detects same-size edits with restored mtime and permission changes", () => {
  const tracker = history();
  const path = join(skill, "SKILL.md");
  const before = statSync(path);
  const first = tracker.fingerprint(skill);
  expect(tracker.fingerprint(skill)).toBe(first);
  writeFileSync(path, "other");
  utimesSync(path, before.atime, before.mtime);
  const edited = tracker.fingerprint(skill);
  expect(edited).not.toBe(first);
  chmodSync(path, 0o755);
  expect(tracker.fingerprint(skill)).not.toBe(edited);
});

test("captures whole-package revisions, deduplicates unchanged files, and survives restart", () => {
  const first = history().capture(skill);
  expect(first.revision).toBe(1);
  expect(history().capture(skill).revision).toBe(1);
  mkdirSync(join(skill, "scripts"));
  writeFileSync(join(skill, "scripts/run.sh"), "echo hello", { mode: 0o755 });
  expect(history().capture(skill).revision).toBe(2);
  db.close();
  db = openDb(join(root, "history.db"));
  expect(
    history()
      .list(skill)
      .map((entry) => entry.revision),
  ).toEqual([2, 1]);
  expect(history().diff(skill, 2)[0]?.path).toBe("scripts/run.sh");
});

test("restores deleted and changed files, removes additions, and appends history", () => {
  history().capture(skill);
  writeFileSync(join(skill, "SKILL.md"), "second");
  writeFileSync(join(skill, "extra.txt"), "extra");
  const second = history().capture(skill);
  const restored = history().restore(skill, 1, second.content_hash);
  expect(restored.revision).toBe(3);
  expect(restored.restored_from).toBe(1);
  expect(readFileSync(join(skill, "SKILL.md"), "utf8")).toBe("first");
  expect(
    history()
      .diff(skill, 3)
      .map((file) => file.change)
      .sort(),
  ).toEqual(["deleted", "modified"]);
});

test("stale restore preserves unobserved edits and rejects overwrite", () => {
  const first = history().capture(skill);
  writeFileSync(join(skill, "SKILL.md"), "unobserved");
  expect(() => history().restore(skill, 1, first.content_hash)).toThrow("changed since review");
  expect(readFileSync(join(skill, "SKILL.md"), "utf8")).toBe("unobserved");
  expect(history().list(skill)).toHaveLength(2);
});

test("deduplicates linked installations and rejects internal symlinks", () => {
  const alias = join(root, "alias");
  symlinkSync(skill, alias);
  history().capture(alias);
  history().capture(skill);
  expect(history().list(alias)).toHaveLength(1);
  symlinkSync(join(root, "history.db"), join(skill, "external"));
  expect(() => history().capture(skill)).toThrow("does not follow links");
});

test("rejects corrupted snapshots before touching installed files", () => {
  const first = history().capture(skill);
  db.query("UPDATE skill_local_revisions SET snapshot_json = ?").run(
    JSON.stringify([{ path: "../escape", content: "", mode: 420 }]),
  );
  expect(() => history().restore(skill, 1, first.content_hash)).toThrow("integrity");
  expect(readFileSync(join(skill, "SKILL.md"), "utf8")).toBe("first");
});

test("automatic scan waits for stable edits and records later reversions", () => {
  const service = createSkillRevisionService(db, join(root, "config"), { paths: () => [skill] });
  service.scan();
  writeFileSync(join(skill, "SKILL.md"), "second");
  service.scan();
  expect(history().list(skill)).toHaveLength(1);
  service.scan();
  expect(history().list(skill)).toHaveLength(2);
  writeFileSync(join(skill, "SKILL.md"), "first");
  service.scan();
  service.scan();
  expect(history().list(skill)).toHaveLength(3);
});

test("HTTP rejects foreign origins and paths outside discovered installations", async () => {
  const service = createSkillRevisionService(db, join(root, "config"), { paths: () => [skill] });
  const url = new URL("http://localhost:8787/api/v2/skill-history");
  const origins = new Set([url.origin]);
  const denied = await service.handle(
    new Request(url, { method: "POST", body: "{}" }),
    url,
    origins,
  );
  expect(denied?.status).toBe(403);
  url.searchParams.set("path", join(root, "SKILL.md"));
  expect((await service.handle(new Request(url), url, origins))?.status).toBe(400);
  url.searchParams.set("path", join(skill, "SKILL.md"));
  const response = await service.handle(new Request(url), url, origins);
  expect(response?.status).toBe(200);
  expect(await response?.json()).toMatchObject({ revisions: [{ revision: 1 }] });
});

test("rejects oversized packages without recording a partial revision", () => {
  writeFileSync(join(skill, "large.bin"), Buffer.alloc(8 * 1024 * 1024));
  expect(() => history().capture(skill)).toThrow("8 MiB");
  expect(history().list(skill)).toHaveLength(0);
});

test("keeps executable permissions and binary bytes through restore", () => {
  const bytes = Buffer.from([0, 255, 1, 2]);
  writeFileSync(join(skill, "run"), bytes, { mode: 0o755 });
  history().capture(skill);
  rmSync(join(skill, "run"));
  const second = history().capture(skill);
  history().restore(skill, 1, second.content_hash);
  expect(readFileSync(join(skill, "run"))).toEqual(bytes);
  expect(history().diff(skill, 3)[0]).toMatchObject({ after: null, afterMode: 0o755 });
});

test("keeps immutable Library packages untouched", () => {
  const immutable = join(root, "config/library/packages/hash/skill");
  mkdirSync(immutable, { recursive: true });
  writeFileSync(join(immutable, "SKILL.md"), "immutable");
  expect(() => history().capture(immutable)).toThrow("Immutable Library");
});

test("running service captures external edits without a history request", async () => {
  const initial = Promise.withResolvers<void>();
  const service = createSkillRevisionService(db, join(root, "config"), {
    paths: () => [skill],
    onChange: () => initial.resolve(),
  });
  service.start();
  try {
    await initial.promise;
    writeFileSync(join(skill, "SKILL.md"), "edited by an external agent");
    await Bun.sleep(10_500);
    expect(
      history()
        .list(skill)
        .map((entry) => entry.revision),
    ).toEqual([2, 1]);
  } finally {
    service.stop();
  }
}, 15_000);
