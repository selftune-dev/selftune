import { Database } from "bun:sqlite";
import {
  getAnalyticsPayload,
  getOverviewPayload,
} from "../packages/runtime/localdb/queries/dashboard.js";
import { queryTrustedSkillObservationRows } from "../packages/runtime/localdb/queries/trust.js";
import { getSkillsList } from "../packages/runtime/localdb/queries/skills.js";
import { listSkillTestingReadiness } from "../packages/runtime/testing-readiness.js";
import { handleDashboardShell } from "../apps/local/src/routes/overview.js";

const databasePath = process.argv[2];
const samples = Number(process.argv[3] ?? 5);
if (!databasePath || !Number.isSafeInteger(samples) || samples < 1 || samples > 1000) {
  throw new Error("Usage: bun scripts/benchmark-local-reads.ts <read-only-db> [samples:1..1000]");
}
const db = new Database(databasePath, { readonly: true });
const percentile = (values: readonly number[], fraction: number) => {
  const sorted = values.toSorted((left, right) => left - right);
  return Math.round((sorted[Math.ceil(sorted.length * fraction) - 1] ?? 0) * 100) / 100;
};

try {
  type BenchmarkResult =
    | ReturnType<typeof queryTrustedSkillObservationRows>
    | ReturnType<typeof getSkillsList>
    | ReturnType<typeof listSkillTestingReadiness>
    | ReturnType<typeof getAnalyticsPayload>
    | ReturnType<typeof getOverviewPayload>
    | Response;
  const operations: ReadonlyArray<readonly [string, () => BenchmarkResult]> = [
    ["trusted", () => queryTrustedSkillObservationRows(db)],
    ["skills", () => getSkillsList(db, [])],
    ["readiness", () => listSkillTestingReadiness(db)],
    ["analytics", () => getAnalyticsPayload(db)],
    ["overview-payload", () => getOverviewPayload(db)],
    ["shell", () => handleDashboardShell(db, "benchmark")],
  ];
  for (const [name, run] of operations) {
    const timings: number[] = [];
    const cpuTimes: number[] = [];
    let bytes = 0;
    for (let iteration = 0; iteration < samples; iteration++) {
      const started = performance.now();
      const cpu = process.cpuUsage();
      const result = run();
      bytes =
        result instanceof Response
          ? (await result.arrayBuffer()).byteLength
          : Buffer.byteLength(JSON.stringify(result));
      timings.push(performance.now() - started);
      const used = process.cpuUsage(cpu);
      cpuTimes.push((used.user + used.system) / 1000);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    console.log(
      JSON.stringify({
        name,
        samples,
        p50Ms: percentile(timings, 0.5),
        p95Ms: percentile(timings, 0.95),
        maxMs: percentile(timings, 1),
        cpuP50Ms: percentile(cpuTimes, 0.5),
        bytes,
        rssMiB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      }),
    );
  }
} finally {
  db.close();
}
