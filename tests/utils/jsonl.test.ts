import { decodeJsonLine } from "../../packages/runtime/utils/jsonl.js";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  appendFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  utimesSync,
  renameSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  fingerprintIngestionFile,
  fileIngestionRevision,
  isFileIngestionCurrent,
  loadFileIngestionMarker,
  loadMarker,
  readJsonl,
  saveFileIngestionMarker,
  saveMarker,
} from "../../packages/runtime/utils/jsonl.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "selftune-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("readJsonl", () => {
  test("returns empty array for missing file", () => {
    expect(readJsonl(join(tmpDir, "nope.jsonl"), decodeJsonLine)).toEqual([]);
  });

  test("parses valid JSONL lines", () => {
    const path = join(tmpDir, "test.jsonl");
    writeFileSync(path, '{"a":1}\n{"b":2}\n');
    const records = readJsonl(path, decodeJsonLine);
    expect(records).toEqual([{ a: 1 }, { b: 2 }]);
  });

  test("skips blank lines and malformed JSON", () => {
    const path = join(tmpDir, "mixed.jsonl");
    writeFileSync(path, '{"ok":true}\n\nnot-json\n{"also":true}\n');
    const records = readJsonl(path, decodeJsonLine);
    expect(records).toEqual([{ ok: true }, { also: true }]);
  });
});

describe("loadMarker / saveMarker", () => {
  test("returns empty set for missing marker", () => {
    expect(loadMarker(join(tmpDir, "nope.json"))).toEqual(new Set());
  });

  test("round-trips a set of strings", () => {
    const path = join(tmpDir, "marker.json");
    const data = new Set(["file-b", "file-a", "file-c"]);
    saveMarker(path, data);
    const loaded = loadMarker(path);
    expect(loaded).toEqual(data);
    // Verify it's sorted in the JSON
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    expect(raw).toEqual(["file-a", "file-b", "file-c"]);
  });

  test("handles corrupted marker gracefully", () => {
    const path = join(tmpDir, "bad.json");
    writeFileSync(path, "not-valid-json{{{");
    expect(loadMarker(path)).toEqual(new Set());
  });
});

describe("append-aware file ingestion markers", () => {
  test("invalidates same-size rewrites and replacement files with preserved modification time", () => {
    const path = join(tmpDir, "same-size.jsonl");
    const replacement = join(tmpDir, "replacement.jsonl");
    const fixedTime = 1_700_000_000;
    writeFileSync(path, "first");
    utimesSync(path, fixedTime, fixedTime);
    const original = fingerprintIngestionFile(path, "v1");
    const marker = new Map([[path, original]]);
    writeFileSync(path, "other");
    utimesSync(path, fixedTime, fixedTime);
    const rewritten = fingerprintIngestionFile(path, "v1");
    expect(rewritten.size).toBe(original.size);
    expect(rewritten.mtime_ms).toBe(original.mtime_ms);
    expect(isFileIngestionCurrent(marker, path, rewritten)).toBe(false);
    expect(fileIngestionRevision(rewritten)).not.toBe(fileIngestionRevision(original));
    marker.set(path, rewritten);
    writeFileSync(replacement, "final");
    utimesSync(replacement, fixedTime, fixedTime);
    renameSync(replacement, path);
    const replaced = fingerprintIngestionFile(path, "v1");
    expect(replaced.size).toBe(rewritten.size);
    expect(replaced.mtime_ms).toBe(rewritten.mtime_ms);
    expect(replaced.file_identity).not.toBe(rewritten.file_identity);
    expect(isFileIngestionCurrent(marker, path, replaced)).toBe(false);
  });
  test("refreshes legacy fingerprints once, then accepts unchanged stat-only state", () => {
    const path = join(tmpDir, "legacy-fingerprint.jsonl");
    writeFileSync(path, "unchanged");
    const fingerprint = fingerprintIngestionFile(path, "v1");
    const { ctime_ns: _ctime, file_identity: _identity, ...legacy } = fingerprint;
    const marker = new Map([[path, legacy]]);
    expect(isFileIngestionCurrent(marker, path, fingerprint)).toBe(false);
    marker.set(path, fingerprint);
    expect(isFileIngestionCurrent(marker, path, fingerprintIngestionFile(path, "v1"))).toBe(true);
  });
  test("round-trips deterministic file fingerprints", () => {
    const markerPath = join(tmpDir, "marker.json");
    const sourcePath = join(tmpDir, "session.jsonl");
    writeFileSync(sourcePath, '{"type":"session"}\n');
    const fingerprint = fingerprintIngestionFile(sourcePath, "1.1.0");
    const marker = new Map([[sourcePath, fingerprint]]);

    saveFileIngestionMarker(markerPath, marker);

    expect(loadFileIngestionMarker(markerPath)).toEqual(marker);
    expect(JSON.parse(readFileSync(markerPath, "utf-8"))).toEqual({
      marker_version: 2,
      files: { [sourcePath]: fingerprint },
    });
  });

  test("treats a legacy path array as pending for one safe migration pass", () => {
    const markerPath = join(tmpDir, "legacy.json");
    writeFileSync(markerPath, JSON.stringify(["/old/session.jsonl"]));

    expect(loadFileIngestionMarker(markerPath)).toEqual(new Map());
  });

  test("invalidates a marker when an append changes the source file", () => {
    const sourcePath = join(tmpDir, "rollout.jsonl");
    writeFileSync(sourcePath, '{"type":"session_meta"}\n');
    const original = fingerprintIngestionFile(sourcePath, "1.1.0");
    const marker = new Map([[sourcePath, original]]);
    expect(isFileIngestionCurrent(marker, sourcePath, original)).toBe(true);

    appendFileSync(sourcePath, '{"type":"event_msg"}\n');
    const appended = fingerprintIngestionFile(sourcePath, "1.1.0");

    expect(isFileIngestionCurrent(marker, sourcePath, appended)).toBe(false);
    expect(appended.size).toBeGreaterThan(original.size);
  });

  test("invalidates unchanged files after a normalizer version bump", () => {
    const sourcePath = join(tmpDir, "transcript.jsonl");
    writeFileSync(sourcePath, '{"type":"user"}\n');
    const oldFingerprint = fingerprintIngestionFile(sourcePath, "1.1.0");
    const marker = new Map([[sourcePath, oldFingerprint]]);
    const newFingerprint = fingerprintIngestionFile(sourcePath, "1.2.0");

    expect(isFileIngestionCurrent(marker, sourcePath, newFingerprint)).toBe(false);
  });

  test("handles corrupted and structurally invalid markers gracefully", () => {
    const markerPath = join(tmpDir, "bad-file-marker.json");
    writeFileSync(markerPath, '{"marker_version":2,"files":{"session":{"size":"large"}}}');
    expect(loadFileIngestionMarker(markerPath)).toEqual(new Map());
  });
});
