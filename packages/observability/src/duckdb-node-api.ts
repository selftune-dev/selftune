import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, rename } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import * as Schema from "effect/Schema";

import {
  makeDuckDbAnalyticalStoreLive,
  type DuckDbAppendValue,
  type DuckDbConnection,
  type DuckDbInstanceFactory,
} from "./duckdb-store.js";
import { resolvePackagedDuckDbModule } from "./duckdb-module-resolution.js";
import {
  ANALYTICAL_RECOVERY_RESERVE_BYTES,
  availableStorageBytes,
  inspectAnalyticalStorageFiles,
  requireStorageCapacity,
} from "./storage-capacity.js";

const packagedDuckDbModule = resolvePackagedDuckDbModule({
  desktopResourceDirectory: process.env.SELFTUNE_DESKTOP_RESOURCE_DIR,
  executablePath: process.execPath,
});
if (packagedDuckDbModule && !process.env.SELFTUNE_DESKTOP_RESOURCE_DIR) {
  process.env.SELFTUNE_DESKTOP_RESOURCE_DIR = packagedDuckDbModule.resourceDirectory;
}
const duckDbModule = packagedDuckDbModule
  ? await import(pathToFileURL(packagedDuckDbModule.modulePath).href)
  : await import(["@duckdb", "node-api"].join("/"));
// SAFETY: Both resolution branches load the pinned @duckdb/node-api package entrypoint; the
// packaged branch changes only its filesystem location so Desktop can load the native binary.
const { DuckDBInstance, DuckDBTimestampValue } = duckDbModule as typeof import("@duckdb/node-api");

/** Bounded desktop analytical-store memory; DuckDB never receives an unlimited process budget. */
export const DUCKDB_LOCAL_MEMORY_LIMIT = "512MB";

interface DuckDbWalRecoveryFileStat {
  readonly size: bigint;
  readonly isFile: () => boolean;
  readonly isSymbolicLink: () => boolean;
}

export interface DuckDbWalRecoveryDependencies<A> {
  readonly availableBytes: (directory: string) => Promise<bigint>;
  readonly copyFile: (source: string, destination: string, mode?: number) => Promise<void>;
  readonly lstat: (path: string) => Promise<DuckDbWalRecoveryFileStat>;
  readonly mkdir: (
    path: string,
    options: { readonly mode: number; readonly recursive: boolean },
  ) => Promise<string | undefined>;
  readonly now: () => Date;
  readonly open: (databasePath: string) => Promise<A>;
  readonly randomUuid: () => string;
  readonly rename: (source: string, destination: string) => Promise<void>;
  readonly warn: (message: string) => void;
}

const WAL_REPLAY_FAILURE_PREFIX = "Failure while replaying WAL file";
const UNBOUND_INDEX_REPLAY_FAILURE =
  "Failed to commit: Unbound index found in DataTable::RemoveFromIndexes";
const CORRUPTED_UNIQUE_ART_REPLAY_FAILURE = "Corrupted unique ART index";
const EXISTING_GATED_LEAF_REPLAY_FAILURE = "encountered an existing gated leaf";

function isKnownWalReplayIndexFailure(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : String(cause);
  return (
    message.includes(WAL_REPLAY_FAILURE_PREFIX) &&
    (message.includes(UNBOUND_INDEX_REPLAY_FAILURE) ||
      (message.includes(CORRUPTED_UNIQUE_ART_REPLAY_FAILURE) &&
        message.includes(EXISTING_GATED_LEAF_REPLAY_FAILURE)))
  );
}

function hasErrorCode(cause: unknown, code: string): boolean {
  // SAFETY-TYPEOF: Recovery accepts native or injected I/O failures; only an exact code match authorizes recovery.
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === code;
}

function assertRegularNonSymlinkFile(path: string, stat: DuckDbWalRecoveryFileStat): void {
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(
      `Refusing automatic DuckDB WAL recovery because "${path}" is not a regular non-symlink file.`,
    );
  }
}

function backupStamp(now: Date): string {
  return now.toISOString().replaceAll("-", "").replaceAll(":", "").replaceAll(".", "");
}

/**
 * Recovers only DuckDB's known WAL-replay/index failure. The checkpoint remains
 * live, while an exclusive backup retains both the checkpoint snapshot and the
 * unreplayable WAL for future repair. Every other open or filesystem failure is
 * returned unchanged instead of widening recovery into a destructive reset.
 */
export async function openDuckDbWithWalRecovery<A>(
  databasePath: string,
  dependencies: DuckDbWalRecoveryDependencies<A>,
): Promise<A> {
  try {
    return await dependencies.open(databasePath);
  } catch (cause) {
    if (!isKnownWalReplayIndexFailure(cause)) throw cause;
  }

  const walPath = `${databasePath}.wal`;
  const databaseStat = await dependencies.lstat(databasePath);
  assertRegularNonSymlinkFile(databasePath, databaseStat);

  let walStat: DuckDbWalRecoveryFileStat;
  try {
    walStat = await dependencies.lstat(walPath);
  } catch (cause) {
    if (hasErrorCode(cause, "ENOENT")) return dependencies.open(databasePath);
    throw cause;
  }
  assertRegularNonSymlinkFile(walPath, walStat);

  const reserve = ANALYTICAL_RECOVERY_RESERVE_BYTES + walStat.size;
  requireStorageCapacity(
    await dependencies.availableBytes(dirname(databasePath)),
    databaseStat.size + reserve,
  );

  const backupRoot = join(dirname(databasePath), "backups");
  await dependencies.mkdir(backupRoot, { recursive: true, mode: 0o700 });
  const backupDirectory = join(
    backupRoot,
    `duckdb-wal-recovery-${backupStamp(dependencies.now())}-${dependencies.randomUuid()}`,
  );
  await dependencies.mkdir(backupDirectory, { recursive: false, mode: 0o700 });
  await dependencies.copyFile(
    databasePath,
    join(backupDirectory, basename(databasePath)),
    constants.COPYFILE_EXCL,
  );

  requireStorageCapacity(await dependencies.availableBytes(dirname(databasePath)), reserve);

  try {
    await dependencies.rename(walPath, join(backupDirectory, basename(walPath)));
  } catch (cause) {
    if (hasErrorCode(cause, "ENOENT")) return dependencies.open(databasePath);
    throw cause;
  }

  dependencies.warn(
    `[selftune] DuckDB quarantined an unreplayable observability WAL. Recovery backup: ${backupDirectory}`,
  );
  return dependencies.open(databasePath);
}

const liveWalRecoveryDependencies = <A>(
  open: (databasePath: string) => Promise<A>,
): DuckDbWalRecoveryDependencies<A> => ({
  availableBytes: availableStorageBytes,
  copyFile,
  lstat: (path) => lstat(path, { bigint: true }),
  mkdir,
  now: () => new Date(),
  open,
  randomUuid: randomUUID,
  rename,
  warn: (message) => process.stderr.write(`${message}\n`),
});

function appendScalar(
  appender: import("@duckdb/node-api").DuckDBAppender,
  value: DuckDbAppendValue,
) {
  // SAFETY-TYPEOF: DuckDbAppendValue is a closed domain union whose primitive members select the
  // corresponding native typed-appender method; the remaining tagged member is a timestamp.
  if (value === null) {
    appender.appendNull();
  } else if (typeof value === "number") {
    if (Number.isInteger(value)) {
      appender.appendBigInt(BigInt(value));
    } else {
      appender.appendDouble(value);
    }
  } else if (typeof value === "string") {
    appender.appendVarchar(value);
  } else {
    appender.appendTimestamp(new DuckDBTimestampValue(value.micros));
  }
}

/**
 * The only production bridge to DuckDB's Node API. It is intentionally kept
 * behind the analytical-store contract so callers cannot acquire arbitrary
 * DuckDB connections or couple operational code to the driver.
 */
const makeDuckDbNodeApiFactory = (
  readAvailableBytes: (directory: string) => Promise<bigint>,
): DuckDbInstanceFactory => ({
  open: async (databasePath) => {
    const instance = await openDuckDbWithWalRecovery(
      databasePath,
      liveWalRecoveryDependencies((path) =>
        DuckDBInstance.create(path, {
          memory_limit: DUCKDB_LOCAL_MEMORY_LIMIT,
          preserve_insertion_order: "false",
          threads: "2",
        }),
      ),
    );
    return {
      closeSync: () => instance.closeSync(),
      connect: async () => {
        const nativeConnection = await instance.connect();
        const connection: DuckDbConnection = {
          appendRows: async (table, rows) => {
            if (rows.length === 0) return;
            const appender = await nativeConnection.createAppender(table);
            try {
              for (const row of rows) {
                for (const value of row) appendScalar(appender, value);
                appender.endRow();
              }
              appender.flushSync();
            } finally {
              appender.closeSync();
            }
          },
          closeSync: () => nativeConnection.closeSync(),
          run: async (sql, parameters) => {
            if (databasePath !== ":memory:" && sql === "BEGIN TRANSACTION") {
              requireStorageCapacity(
                await readAvailableBytes(dirname(databasePath)),
                ANALYTICAL_RECOVERY_RESERVE_BYTES,
              );
            }
            return nativeConnection.run(sql, parameters);
          },
        };
        return connection;
      },
    };
  },
});

export const makeDuckDbNodeApiAnalyticalStoreLive = (
  databasePath?: string,
  readAvailableBytes: (directory: string) => Promise<bigint> = availableStorageBytes,
) => makeDuckDbAnalyticalStoreLive(makeDuckDbNodeApiFactory(readAvailableBytes), databasePath);

export const DuckDbAnalyticalStoreLive = makeDuckDbNodeApiAnalyticalStoreLive();

const StorageCatalogTable = Schema.Struct({
  table_name: Schema.String,
  estimated_rows: Schema.String,
  index_count: Schema.String,
});
const StorageBlocks = Schema.Struct({
  block_size: Schema.String,
  total_blocks: Schema.String,
  used_blocks: Schema.String,
  free_blocks: Schema.String,
  wal_size: Schema.String,
});
const EngineVersion = Schema.Struct({ engine_version: Schema.String });
const MigrationLedgerPresence = Schema.Struct({ present: Schema.Boolean });
const StoredSchemaVersion = Schema.Struct({ version: Schema.String });

/** Explicit diagnostics, outside the mutating live-store acquisition/migration path. */
export async function inspectAnalyticalStorage(databasePath: string) {
  const files = await inspectAnalyticalStorageFiles(databasePath);
  if (files.database.state !== "present") {
    return { files, catalog: { state: "unavailable", reason: files.database.state } };
  }
  const instance = await DuckDBInstance.create(databasePath, {
    access_mode: "READ_ONLY",
    memory_limit: "128MB",
    max_temp_directory_size: "0B",
    threads: "1",
  });
  try {
    const connection = await instance.connect();
    try {
      const version = await connection.run("SELECT version() AS engine_version");
      const engine = Schema.decodeUnknownSync(Schema.Array(EngineVersion))(
        await version.getRowObjects(),
      );
      const sizes = await connection.run(`SELECT
        CAST(block_size AS VARCHAR) AS block_size,
        CAST(total_blocks AS VARCHAR) AS total_blocks,
        CAST(used_blocks AS VARCHAR) AS used_blocks,
        CAST(free_blocks AS VARCHAR) AS free_blocks,
        wal_size
        FROM pragma_database_size()`);
      const blocks = Schema.decodeUnknownSync(Schema.Array(StorageBlocks))(
        await sizes.getRowObjects(),
      );
      const tables = await connection.run(`SELECT table_name,
        CAST(estimated_size AS VARCHAR) AS estimated_rows,
        CAST(index_count AS VARCHAR) AS index_count
        FROM duckdb_tables()
        WHERE schema_name = 'main' AND starts_with(table_name, 'observability_')
        ORDER BY table_name LIMIT 64`);
      const catalog = Schema.decodeUnknownSync(Schema.Array(StorageCatalogTable))(
        await tables.getRowObjects(),
      );
      const ledgerPresence = await connection.run(`SELECT EXISTS (
        SELECT 1 FROM duckdb_tables()
        WHERE schema_name = 'main' AND table_name = 'observability_schema_migrations'
      ) AS present`);
      const [ledger] = Schema.decodeUnknownSync(Schema.Array(MigrationLedgerPresence))(
        await ledgerPresence.getRowObjects(),
      );
      const schemaVersion = ledger?.present
        ? Schema.decodeUnknownSync(Schema.Array(StoredSchemaVersion))(
            await (
              await connection.run(`SELECT CAST(version AS VARCHAR) AS version
                FROM main.observability_schema_migrations
                ORDER BY main.observability_schema_migrations.version DESC LIMIT 1`)
            ).getRowObjects(),
          )[0]?.version
        : undefined;
      return {
        files,
        catalog: {
          state: "available",
          engine,
          stored_schema:
            schemaVersion === undefined
              ? {
                  state: "unavailable",
                  reason: ledger?.present ? "empty_ledger" : "missing_ledger",
                }
              : { state: "available", version: schemaVersion },
          blocks,
          tables: catalog,
          row_counts: "estimates_not_exact",
          table_limit: 64,
        },
      };
    } finally {
      connection.closeSync();
    }
  } finally {
    instance.closeSync();
  }
}
