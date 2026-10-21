import { expect } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";
import { sourceDigest } from "@selftune/observability/source-reconstruction";
import * as Schema from "effect/Schema";

const TableNames = Schema.Array(Schema.Struct({ table_name: Schema.String }));
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

/** Test-only closed-writer copy; never swaps, deletes, or opens a live store. */
export async function compactFixture(source: string, destination: string) {
  expect(existsSync(destination)).toBe(false);
  expect(existsSync(`${source}.wal`)).toBe(false);
  expect(statSync(source).size).toBeLessThan(32 * 1024 * 1024);
  const originalDigest = sourceDigest(readFileSync(source));
  const db = await DuckDBInstance.create(":memory:", {
    memory_limit: "128MB",
    threads: "1",
    max_temp_directory_size: "0B",
  });
  try {
    const connection = await db.connect();
    try {
      await connection.run(`ATTACH ${literal(source)} AS original (READ_ONLY)`);
      await connection.run(`ATTACH ${literal(destination)} AS compacted`);
      await connection.run("COPY FROM DATABASE original TO compacted");
      const tables = Schema.decodeUnknownSync(TableNames)(
        await (
          await connection.run(
            "SELECT table_name FROM duckdb_tables() WHERE database_name = 'original' ORDER BY table_name",
          )
        ).getRowObjects(),
      );
      expect(tables.length).toBeGreaterThan(0);
      for (const { table_name } of tables) {
        const table = identifier(table_name);
        const original = await connection.run(`SELECT * FROM original.main.${table} ORDER BY ALL`);
        const compacted = await connection.run(
          `SELECT * FROM compacted.main.${table} ORDER BY ALL`,
        );
        expect(await compacted.getRowObjects()).toEqual(await original.getRowObjects());
      }
      for (const catalog of [
        "SELECT table_name FROM duckdb_tables()",
        "SELECT view_name FROM duckdb_views()",
        "SELECT table_name, index_name, is_unique, expressions FROM duckdb_indexes()",
        "SELECT table_name, constraint_type, constraint_text FROM duckdb_constraints()",
      ]) {
        const original = await connection.run(
          `${catalog} WHERE database_name = 'original' ORDER BY ALL`,
        );
        const compacted = await connection.run(
          `${catalog} WHERE database_name = 'compacted' ORDER BY ALL`,
        );
        expect(await compacted.getRowObjects()).toEqual(await original.getRowObjects());
      }
      await connection.run("CHECKPOINT compacted");
    } finally {
      connection.closeSync();
    }
  } finally {
    db.closeSync();
  }
  expect(sourceDigest(readFileSync(source))).toBe(originalDigest);
  expect(existsSync(`${destination}.wal`)).toBe(false);
  const allocated = {
    original: statSync(source).blocks * 512,
    compacted: statSync(destination).blocks * 512,
  };
  expect(allocated.compacted).toBeLessThan(32 * 1024 * 1024);
  console.info("compaction fixture allocated bytes", allocated);
  return allocated;
}
