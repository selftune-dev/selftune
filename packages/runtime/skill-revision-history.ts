import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { Database } from "bun:sqlite";
import { getSkillRevision, listSkillRevisions, recordSkillRevision } from "@selftune/local-store";
import { Schema } from "effect";

const SnapshotFile = Schema.Struct({
  path: Schema.String,
  content: Schema.String,
  mode: Schema.Number,
});
const Snapshot = Schema.Array(SnapshotFile);
type FileSnapshot = typeof Snapshot.Type;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 512;

function safeRelativePath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    path.split("/").every((part) => part !== ".." && part !== "." && part.length > 0)
  );
}

function snapshotPackage(root: string): FileSnapshot {
  const files: Array<typeof SnapshotFile.Type> = [];
  let bytes = 0;
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = join(directory, entry.name);
      const relativePath = relative(root, path);
      if (!safeRelativePath(relativePath)) throw new Error("Unsupported skill file path.");
      if (entry.isSymbolicLink())
        throw new Error("Skill history does not follow links inside a skill package.");
      if (entry.isDirectory()) {
        visit(path);
        continue;
      }
      if (!entry.isFile()) throw new Error("Skill history only supports regular files.");
      const stat = lstatSync(path);
      bytes += stat.size;
      if (bytes > MAX_BYTES || files.length >= MAX_FILES)
        throw new Error("Skill history supports packages up to 8 MiB and 512 files.");
      const content = readFileSync(path);
      bytes += content.length - stat.size;
      if (bytes > MAX_BYTES) throw new Error("Skill changed beyond the 8 MiB history limit.");
      files.push({
        path: relativePath,
        content: content.toString("base64"),
        mode: stat.mode & 0o777,
      });
    }
  };
  visit(root);
  if (!files.some((file) => file.path === "SKILL.md"))
    throw new Error("Skill package must contain SKILL.md.");
  return files;
}

function hashSnapshot(files: FileSnapshot): string {
  return createHash("sha256").update(JSON.stringify(files)).digest("hex");
}

function packageMetadata(root: string): string {
  const entries: string[] = [];
  let bytes = 0;
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).toSorted((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error("Skill history does not follow links inside a skill package.");
      if (entry.isDirectory()) {
        visit(path);
        continue;
      }
      if (!entry.isFile()) throw new Error("Skill history only supports regular files.");
      const stat = lstatSync(path, { bigint: true });
      bytes += Number(stat.size);
      if (bytes > MAX_BYTES || entries.length >= MAX_FILES)
        throw new Error("Skill history supports packages up to 8 MiB and 512 files.");
      entries.push(
        JSON.stringify([
          relative(root, path),
          String(stat.ino),
          String(stat.size),
          String(stat.mtimeNs),
          String(stat.ctimeNs),
          String(stat.mode),
        ]),
      );
    }
  };
  visit(root);
  return entries.join("\n");
}

export function createSkillRevisionHistory(db: Database, configRoot: string) {
  const fingerprints = new Map<string, { metadata: string; hash: string }>();
  const canonicalPath = (path: string): string => {
    const root = realpathSync(path);
    const libraryPath = resolve(configRoot, "library");
    const library = existsSync(libraryPath) ? realpathSync(libraryPath) : libraryPath;
    const withinLibrary = relative(library, root);
    if (
      withinLibrary === "" ||
      (!withinLibrary.startsWith("..") && !withinLibrary.startsWith("/"))
    ) {
      throw new Error(
        "Immutable Library packages cannot be restored in place. Install an editable copy first.",
      );
    }
    return root;
  };
  const capture = (path: string, reason = "observed", restoredFrom: number | null = null) => {
    const root = canonicalPath(path);
    const files = snapshotPackage(root);
    const contentHash = hashSnapshot(files);
    if (hashSnapshot(snapshotPackage(root)) !== contentHash)
      throw new Error("Skill changed during capture; retry after the edit finishes.");
    return recordSkillRevision(db, {
      package_path: root,
      content_hash: contentHash,
      captured_at: new Date().toISOString(),
      reason,
      restored_from: restoredFrom,
      snapshot_json: JSON.stringify(files),
    });
  };
  const read = (path: string, revision: number) => {
    const stored = getSkillRevision(db, canonicalPath(path), revision);
    if (!stored) throw new Error("Revision not found.");
    const files = Schema.decodeUnknownSync(Schema.fromJsonString(Snapshot))(stored.snapshot_json);
    if (
      files.some((file) => !safeRelativePath(file.path)) ||
      hashSnapshot(files) !== stored.content_hash
    )
      throw new Error("Revision snapshot failed its integrity check.");
    return files;
  };
  return {
    capture,
    fingerprint: (path: string) => {
      const root = canonicalPath(path);
      const metadata = packageMetadata(root);
      const cached = fingerprints.get(root);
      if (cached?.metadata === metadata) return cached.hash;
      const hash = hashSnapshot(snapshotPackage(root));
      if (packageMetadata(root) !== metadata)
        throw new Error("Skill changed during capture; retry after the edit finishes.");
      if (fingerprints.size >= 2048) fingerprints.clear();
      fingerprints.set(root, { metadata, hash });
      return hash;
    },
    list: (path: string, before?: number) => listSkillRevisions(db, canonicalPath(path), before),
    diff: (path: string, revision: number) => {
      const after = read(path, revision);
      const before = revision > 1 ? read(path, revision - 1) : [];
      const previous = new Map(before.map((file) => [file.path, file]));
      const current = new Map(after.map((file) => [file.path, file]));
      return [...new Set([...previous.keys(), ...current.keys()])].sort().flatMap((filePath) => {
        const left = previous.get(filePath);
        const right = current.get(filePath);
        if (left?.content === right?.content && left?.mode === right?.mode) return [];
        const text = (file: typeof SnapshotFile.Type | undefined) => {
          if (!file) return null;
          const bytes = Buffer.from(file.content, "base64");
          const value = bytes.toString("utf8");
          return value.includes("\0") || !Buffer.from(value).equals(bytes) ? null : value;
        };
        return [
          {
            path: filePath,
            change: !left ? "added" : !right ? "deleted" : "modified",
            before: text(left),
            after: text(right),
            beforeMode: left?.mode ?? null,
            afterMode: right?.mode ?? null,
          },
        ];
      });
    },
    restore: (path: string, revision: number, expectedHash: string) => {
      const root = canonicalPath(path);
      const files = read(root, revision);
      const current = capture(root, "before_restore");
      if (current.content_hash !== expectedHash)
        throw new Error("Skill changed since review. Refresh history before restoring.");
      const staging = join(dirname(root), `.selftune-restore-${randomUUID()}`);
      const backup = `${staging}-previous`;
      mkdirSync(staging, { mode: lstatSync(root).mode & 0o777 });
      let moved = false;
      try {
        for (const file of files) {
          const target = join(staging, file.path);
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, Buffer.from(file.content, "base64"), { mode: file.mode });
          chmodSync(target, file.mode);
        }
        if (hashSnapshot(snapshotPackage(root)) !== expectedHash)
          throw new Error("Skill changed during restore preparation. Retry after editing stops.");
        renameSync(root, backup);
        moved = true;
        renameSync(staging, root);
        const result = capture(root, "restore", revision);
        moved = false;
        rmSync(backup, { recursive: true });
        return result;
      } catch (error) {
        if (moved) {
          rmSync(root, { recursive: true, force: true });
          renameSync(backup, root);
        }
        throw error;
      } finally {
        rmSync(staging, { recursive: true, force: true });
      }
    },
  };
}
