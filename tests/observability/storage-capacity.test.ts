import { afterEach, expect, test } from "bun:test";
import { lstatSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  inspectAnalyticalStorageFiles,
  requireStorageCapacity,
} from "@selftune/observability/storage-capacity";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

test("reports allocated and logical bytes without reading or returning file contents or paths", async () => {
  const directory = mkdtempSync(join(tmpdir(), "selftune-storage-metadata-"));
  directories.push(directory);
  const path = join(directory, "observability.duckdb");
  const payload = "not-a-database-private-payload";
  writeFileSync(path, payload);
  const result = await inspectAnalyticalStorageFiles(path);
  const metadata = lstatSync(path, { bigint: true });
  expect(result.database).toEqual({
    state: "present",
    logical_bytes: metadata.size.toString(),
    allocated_bytes: (metadata.blocks * 512n).toString(),
  });
  expect(result.wal).toEqual({ state: "missing" });
  expect(BigInt(result.available_bytes)).toBeGreaterThan(0n);
  expect(JSON.stringify(result)).not.toContain(payload);
  expect(JSON.stringify(result)).not.toContain(directory);
  symlinkSync(path, `${path}.wal`);
  expect((await inspectAnalyticalStorageFiles(path)).wal).toEqual({ state: "unsafe_file_type" });
});

test("headroom comparisons remain exact beyond Number.MAX_SAFE_INTEGER", () => {
  const required = 2n ** 54n;
  expect(() => requireStorageCapacity(required, required)).not.toThrow();
  expect(() => requireStorageCapacity(required - 1n, required)).toThrow("maintenance deferred");
});
