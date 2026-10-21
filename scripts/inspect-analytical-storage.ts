import { inspectAnalyticalStorage } from "@selftune/observability/duckdb-node-api";

const [path, ...extra] = process.argv.slice(2);
if (!path || extra.length > 0) {
  process.stderr.write(
    "Usage: bun scripts/inspect-analytical-storage.ts /explicit/path/observability.duckdb\n",
  );
  process.exitCode = 2;
} else {
  try {
    process.stdout.write(`${JSON.stringify(await inspectAnalyticalStorage(path), null, 2)}\n`);
  } catch {
    process.stderr.write(
      "Storage inspection unavailable. Close the database owner and retry; no migration, recovery, or repair was attempted.\n",
    );
    process.exitCode = 1;
  }
}
