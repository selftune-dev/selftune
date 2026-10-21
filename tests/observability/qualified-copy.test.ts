import { test, expect } from "bun:test";
import { DuckDBInstance } from "@duckdb/node-api";
import {
  mkdtempSync,
  rmSync,
  statSync,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { qualifyAnalyticalCopy } from "../../scripts/qualify-analytical-copy";

test("qualified copy preserves raw rows, constraints, indexes, views and source bytes", async () => {
  const directory = mkdtempSync(join(tmpdir(), "selftune-qualified-copy-"));
  const source = join(directory, "snapshot.duckdb"),
    destination = join(directory, "qualified.duckdb");
  const budgets = { maxOutputMiB: 16, reserveMiB: 256, tempMiB: 0, memoryMiB: 128 };
  try {
    const db = await DuckDBInstance.create(source);
    const connection = await db.connect();
    await connection.run(
      "CREATE TABLE evidence (id INTEGER PRIMARY KEY, value VARCHAR NOT NULL CHECK (length(value) > 0), raw BLOB)",
    );
    await connection.run(
      "INSERT INTO evidence VALUES (1, 'private fact', '\\x00\\x01'::BLOB), (2, 'another fact', NULL)",
    );
    await connection.run("CREATE INDEX evidence_value ON evidence(value)");
    await connection.run("CREATE VIEW evidence_view AS SELECT id, value FROM evidence");
    connection.closeSync();
    db.closeSync();
    const original = readFileSync(source);
    const receipt = await qualifyAnalyticalCopy(source, destination, budgets);
    expect(receipt.qualified).toBe(true);
    expect(receipt.tables).toBe(1);
    expect(receipt.destinationBytes).toBe(statSync(destination).size);
    expect(readFileSync(source)).toEqual(original);
    const reader = await DuckDBInstance.create(destination, { access_mode: "READ_ONLY" });
    const read = await reader.connect();
    expect(
      await (await read.run("SELECT COUNT(*) AS count FROM evidence_view")).getRowObjects(),
    ).toEqual([{ count: 2n }]);
    read.closeSync();
    reader.closeSync();
    await expect(qualifyAnalyticalCopy(source, destination, budgets)).rejects.toThrow(
      "Destination must not exist",
    );
    const before = statSync(source).size;
    writeFileSync(`${source}.wal`, "writer marker");
    await expect(
      qualifyAnalyticalCopy(source, join(directory, "blocked.duckdb"), budgets),
    ).rejects.toThrow("without a WAL");
    expect(existsSync(join(directory, "blocked.duckdb"))).toBe(false);
    expect(statSync(source).size).toBe(before);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("unsupported catalogs and invalid budgets never publish an unqualified copy", async () => {
  const directory = mkdtempSync(join(tmpdir(), "selftune-qualified-reject-"));
  const source = join(directory, "snapshot.duckdb"),
    destination = join(directory, "must-not-exist.duckdb");
  try {
    const db = await DuckDBInstance.create(source);
    const connection = await db.connect();
    await connection.run("CREATE TABLE facts (id INTEGER)");
    await connection.run("CREATE SEQUENCE outside_supported_catalog");
    connection.closeSync();
    db.closeSync();
    const budgets = { maxOutputMiB: 16, reserveMiB: 256, tempMiB: 0, memoryMiB: 128 };
    await expect(qualifyAnalyticalCopy(source, destination, budgets)).rejects.toThrow(
      "outside this qualifier",
    );
    expect(existsSync(destination)).toBe(false);
    expect(readdirSync(directory).some((entry) => entry.startsWith(".selftune-qualified-"))).toBe(
      false,
    );
    await expect(
      qualifyAnalyticalCopy(source, destination, { ...budgets, memoryMiB: 8192 }),
    ).rejects.toThrow("memoryMiB");
    expect(existsSync(destination)).toBe(false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
