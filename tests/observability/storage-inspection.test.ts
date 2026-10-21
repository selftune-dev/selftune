import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { inspectAnalyticalStorage } from "@selftune/observability/duckdb-node-api";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

test("catalog diagnostics leave an old schema byte-identical and omit private rows", async () => {
  const directory = mkdtempSync(join(tmpdir(), "selftune-storage-profile-"));
  directories.push(directory);
  const path = join(directory, "observability.duckdb");
  const db = await DuckDBInstance.create(path);
  const connection = await db.connect();
  await connection.run("CREATE TABLE observability_old_fixture (private_payload VARCHAR)");
  await connection.run("INSERT INTO observability_old_fixture VALUES ('secret-session-text')");
  connection.closeSync();
  db.closeSync();
  const digest = () => createHash("sha256").update(readFileSync(path)).digest("hex");
  const before = digest();
  const report = await inspectAnalyticalStorage(path);
  expect(report.catalog.state).toBe("available");
  expect("stored_schema" in report.catalog && report.catalog.stored_schema).toEqual({
    state: "unavailable",
    reason: "missing_ledger",
  });
  expect(JSON.stringify(report)).toContain("observability_old_fixture");
  expect(JSON.stringify(report)).toContain("estimates_not_exact");
  expect(JSON.stringify(report)).not.toContain("secret-session-text");
  expect(JSON.stringify(report)).not.toContain(directory);
  expect(digest()).toBe(before);
  expect(readdirSync(directory)).toEqual(["observability.duckdb"]);
});

test.each([{ versions: [] }, { versions: [1, 8, 9] }, { versions: [1, 42] }])(
  "reports the stored migration ledger without upgrading or downgrading it: %j",
  async ({ versions }) => {
    const directory = mkdtempSync(join(tmpdir(), "selftune-storage-schema-"));
    directories.push(directory);
    const path = join(directory, "observability.duckdb");
    const db = await DuckDBInstance.create(path);
    const connection = await db.connect();
    try {
      await connection.run(
        "CREATE TABLE observability_schema_migrations (version INTEGER PRIMARY KEY)",
      );
      for (const version of versions) {
        await connection.run("INSERT INTO observability_schema_migrations VALUES ($version)", {
          version,
        });
      }
    } finally {
      connection.closeSync();
      db.closeSync();
    }
    const before = createHash("sha256").update(readFileSync(path)).digest("hex");
    const report = await inspectAnalyticalStorage(path);
    expect("stored_schema" in report.catalog && report.catalog.stored_schema).toEqual(
      versions.length > 0
        ? { state: "available", version: String(Math.max(...versions)) }
        : { state: "unavailable", reason: "empty_ledger" },
    );
    expect(createHash("sha256").update(readFileSync(path)).digest("hex")).toBe(before);
    expect(readdirSync(directory)).toEqual(["observability.duckdb"]);
  },
);

test("missing database is unavailable, never created as an empty successful inspection", async () => {
  const directory = mkdtempSync(join(tmpdir(), "selftune-storage-absent-"));
  directories.push(directory);
  const report = await inspectAnalyticalStorage(join(directory, "missing.duckdb"));
  expect(report.catalog).toEqual({ state: "unavailable", reason: "missing" });
  expect(readdirSync(directory)).toEqual([]);
});
