import { DuckDBInstance } from "@duckdb/node-api";
import {
  existsSync,
  linkSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  statSync,
  statfsSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import * as Schema from "effect/Schema";

const MiB = 1024 ** 2;
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const Tables = Schema.Array(
  Schema.Struct({ schema_name: Schema.String, table_name: Schema.String }),
);
const Differences = Schema.Array(Schema.Struct({ differences: Schema.String }));
const Receipt = Schema.Struct({
  qualified: Schema.Literal(true),
  tables: Schema.Number,
  sourceBytes: Schema.Number,
  destinationBytes: Schema.Number,
  elapsedMs: Schema.Number,
});
type CopyReceipt = typeof Receipt.Type;
interface CopyBudgets {
  maxOutputMiB: number;
  reserveMiB: number;
  tempMiB: number;
  memoryMiB: number;
}
const defaults: CopyBudgets = {
  maxOutputMiB: 4096,
  reserveMiB: 4096,
  tempMiB: 2048,
  memoryMiB: 1024,
};

function validateBudgets(budgets: CopyBudgets) {
  for (const [key, minimum, maximum] of [
    ["maxOutputMiB", 16, 8192],
    ["reserveMiB", 256, 16384],
    ["tempMiB", 0, 4096],
    ["memoryMiB", 64, 1024],
  ] as const) {
    const value = budgets[key];
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
      throw new Error(`${key} must be an integer in ${minimum}..${maximum}`);
  }
}
const capacity = (directory: string) => {
  const fs = statfsSync(directory);
  return fs.bavail * fs.bsize;
};

/** Closed-writer snapshot only. Never replaces, migrates, or deletes the source. */
export async function qualifyAnalyticalCopy(
  sourcePath: string,
  destinationPath: string,
  options: Partial<CopyBudgets> = {},
): Promise<CopyReceipt> {
  const budgets = { ...defaults, ...options };
  validateBudgets(budgets);
  const source = realpathSync(sourcePath);
  const destination = resolve(destinationPath);
  if (!statSync(source).isFile() || existsSync(`${source}.wal`))
    throw new Error("Provide a closed-writer snapshot without a WAL");
  if (existsSync(destination)) throw new Error("Destination must not exist");
  const parent = realpathSync(dirname(destination));
  if (capacity(parent) < (budgets.maxOutputMiB + budgets.tempMiB + budgets.reserveMiB) * MiB)
    throw new Error("Insufficient free space for the explicit output, spill, and reserve budgets");
  const directory = mkdtempSync(join(parent, ".selftune-qualified-"));
  const staged = join(directory, "database.duckdb");
  const child = Bun.spawn(
    [
      process.execPath,
      import.meta.filename,
      "--worker",
      source,
      staged,
      "--max-output-mib",
      String(budgets.maxOutputMiB),
      "--reserve-mib",
      String(budgets.reserveMiB),
      "--temp-mib",
      String(budgets.tempMiB),
      "--memory-mib",
      String(budgets.memoryMiB),
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  let budgetFailure: string | null = null;
  const deadline = Date.now() + 120_000;
  const monitor = setInterval(() => {
    try {
      const size =
        (existsSync(staged) ? statSync(staged).size : 0) +
        (existsSync(`${staged}.wal`) ? statSync(`${staged}.wal`).size : 0);
      if (
        size > budgets.maxOutputMiB * MiB ||
        capacity(parent) < budgets.reserveMiB * MiB ||
        Date.now() > deadline
      ) {
        budgetFailure = "Copy exceeded its output, free-space, or time budget";
        child.kill("SIGKILL");
      }
    } catch {
      budgetFailure = "Unable to verify the copy's resource budget";
      child.kill("SIGKILL");
    }
  }, 100);
  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (budgetFailure || code !== 0)
      throw new Error(
        budgetFailure ?? `Copy qualification failed (${code}): ${stderr.slice(-1000)}`,
      );
    const receipt = Schema.decodeUnknownSync(Schema.fromJsonString(Receipt))(stdout.trim());
    if (existsSync(`${staged}.wal`) || receipt.destinationBytes > budgets.maxOutputMiB * MiB)
      throw new Error("Qualified copy still has a WAL or exceeds its output budget");
    // An exclusive hard link publishes only the verified file; races never overwrite a destination.
    linkSync(staged, destination);
    return receipt;
  } finally {
    clearInterval(monitor);
    if (child.exitCode === null) child.kill("SIGKILL");
    await child.exited;
    rmSync(directory, { recursive: true, force: true });
  }
}

async function copyAndVerify(source: string, destination: string, budgets: CopyBudgets) {
  const before = statSync(source, { bigint: true });
  const database = await DuckDBInstance.create(":memory:", {
    memory_limit: `${budgets.memoryMiB}MB`,
    threads: "1",
    preserve_insertion_order: "false",
    max_temp_directory_size: `${budgets.tempMiB}MB`,
    temp_directory: join(dirname(destination), "spill"),
  });
  const connection = await database.connect();
  const started = performance.now();
  try {
    await connection.run(`ATTACH ${literal(source)} AS original (READ_ONLY)`);
    // This maintenance tool qualifies SelfTune's table/view store, not arbitrary database extensions.
    for (const query of ["SELECT * FROM duckdb_sequences()", "SELECT * FROM duckdb_functions()"])
      if (
        (await (await connection.run(`${query} WHERE database_name = 'original'`)).getRowObjects())
          .length
      )
        throw new Error(
          "Source has sequences or user functions outside this qualifier's supported catalog",
        );
    await connection.run(`ATTACH ${literal(destination)} AS compacted`);
    await connection.run("COPY FROM DATABASE original TO compacted");
    const tables = Schema.decodeUnknownSync(Tables)(
      await (
        await connection.run(
          "SELECT schema_name, table_name FROM duckdb_tables() WHERE database_name = 'original' ORDER BY ALL",
        )
      ).getRowObjects(),
    );
    if (!tables.length) throw new Error("The source has no tables to qualify");
    for (const table of tables) {
      const name = `${identifier(table.schema_name)}.${identifier(table.table_name)}`;
      const rows = Schema.decodeUnknownSync(Differences)(
        await (
          await connection.run(
            `SELECT CAST(COUNT(*) AS VARCHAR) AS differences FROM (
          (SELECT * FROM original.${name} EXCEPT ALL SELECT * FROM compacted.${name})
          UNION ALL (SELECT * FROM compacted.${name} EXCEPT ALL SELECT * FROM original.${name})
        ) AS differences`,
          )
        ).getRowObjects(),
      );
      if (rows[0]?.differences !== "0") throw new Error("Full-row parity failed");
    }
    for (const catalog of [
      "SELECT schema_name FROM duckdb_schemas()",
      "SELECT schema_name,table_name FROM duckdb_tables()",
      "SELECT schema_name,table_name,column_name,data_type,is_nullable,column_default FROM duckdb_columns()",
      "SELECT schema_name,table_name,constraint_type,constraint_text,constraint_column_names FROM duckdb_constraints()",
      "SELECT schema_name,table_name,index_name,is_unique,is_primary,expressions FROM duckdb_indexes()",
      "SELECT schema_name,view_name,sql FROM duckdb_views()",
    ]) {
      const original = await (
        await connection.run(`${catalog} WHERE database_name = 'original' ORDER BY ALL`)
      ).getRowObjects();
      const compacted = await (
        await connection.run(`${catalog} WHERE database_name = 'compacted' ORDER BY ALL`)
      ).getRowObjects();
      if (JSON.stringify(original) !== JSON.stringify(compacted))
        throw new Error("Catalog parity failed");
    }
    await connection.run("CHECKPOINT compacted");
    const after = statSync(source, { bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs ||
      existsSync(`${source}.wal`)
    )
      throw new Error("Source identity or metadata changed while qualifying the copy");
    return {
      qualified: true,
      tables: tables.length,
      sourceBytes: Number(before.size),
      destinationBytes: statSync(destination).size,
      elapsedMs: performance.now() - started,
    } satisfies CopyReceipt;
  } finally {
    connection.closeSync();
    database.closeSync();
  }
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      help: { type: "boolean" },
      worker: { type: "boolean" },
      "max-output-mib": { type: "string", default: "4096" },
      "reserve-mib": { type: "string", default: "4096" },
      "temp-mib": { type: "string", default: "2048" },
      "memory-mib": { type: "string", default: "1024" },
    },
  });
  if (values.help)
    console.log(
      "Usage: bun scripts/qualify-analytical-copy.ts <closed-snapshot> <new-copy> [--max-output-mib 4096 --reserve-mib 4096 --temp-mib 2048 --memory-mib 1024]\nCreates a verified copy only. Never installs it, replaces the source, or removes history.",
    );
  else {
    const [source, destination] = positionals;
    if (!source || !destination || positionals.length !== 2)
      throw new Error("Provide a closed snapshot and a new destination; see --help");
    const budgets = {
      maxOutputMiB: Number(values["max-output-mib"]),
      reserveMiB: Number(values["reserve-mib"]),
      tempMiB: Number(values["temp-mib"]),
      memoryMiB: Number(values["memory-mib"]),
    };
    validateBudgets(budgets);
    console.log(
      JSON.stringify(
        values.worker
          ? await copyAndVerify(source, destination, budgets)
          : await qualifyAnalyticalCopy(source, destination, budgets),
      ),
    );
  }
}
