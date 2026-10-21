import { lstat, statfs } from "node:fs/promises";
import { dirname } from "node:path";

export const ANALYTICAL_RECOVERY_RESERVE_BYTES = 512n * 1024n * 1024n;

export class AnalyticalStoragePressureError extends Error {
  readonly code = "ANALYTICAL_STORAGE_PRESSURE";

  constructor(
    readonly availableBytes: bigint,
    readonly requiredBytes: bigint,
  ) {
    super(
      `Analytical maintenance deferred: ${requiredBytes} free bytes required, ${availableBytes} available. Free space and retry; do not reset or delete the analytical database.`,
    );
    this.name = "AnalyticalStoragePressureError";
  }
}

export async function availableStorageBytes(directory: string): Promise<bigint> {
  const capacity = await statfs(directory, { bigint: true });
  return capacity.bavail * capacity.bsize;
}

export function requireStorageCapacity(availableBytes: bigint, requiredBytes: bigint): void {
  if (availableBytes < requiredBytes) {
    throw new AnalyticalStoragePressureError(availableBytes, requiredBytes);
  }
}

type FileFootprint =
  | { readonly state: "missing" }
  | { readonly state: "unsafe_file_type" }
  | { readonly state: "present"; readonly logical_bytes: string; readonly allocated_bytes: string };

async function fileFootprint(path: string): Promise<FileFootprint> {
  try {
    const metadata = await lstat(path, { bigint: true });
    if (!metadata.isFile() || metadata.isSymbolicLink()) return { state: "unsafe_file_type" };
    return {
      state: "present",
      logical_bytes: metadata.size.toString(),
      allocated_bytes: (metadata.blocks * 512n).toString(),
    };
  } catch (cause) {
    // SAFETY-TYPEOF: Only a filesystem ENOENT proves absence; access/I/O failures remain failures.
    if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT") {
      return { state: "missing" };
    }
    throw cause;
  }
}

/** Filesystem metadata only: never opens DuckDB, follows file symlinks, or scans source logs. */
export async function inspectAnalyticalStorageFiles(databasePath: string) {
  const [database, wal, available] = await Promise.all([
    fileFootprint(databasePath),
    fileFootprint(`${databasePath}.wal`),
    availableStorageBytes(dirname(databasePath)),
  ]);
  return {
    database,
    wal,
    available_bytes: available.toString(),
    coverage: "database_and_wal_only",
  };
}
