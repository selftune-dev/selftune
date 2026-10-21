import { Database } from "bun:sqlite";
import { handleDashboardShell, handleOverview } from "../apps/local/src/routes/overview.js";

const databasePath = process.argv[2];
if (!databasePath) throw new Error("Usage: bun scripts/benchmark-dashboard.ts <database-path>");

// Read-only, local measurements; never print records, paths, or credentials.
const db = new Database(databasePath, { readonly: true });
try {
  for (const [name, handler] of [
    ["shell-cold", handleDashboardShell],
    ["shell-warm", handleDashboardShell],
    ["overview", handleOverview],
  ] as const) {
    const started = performance.now();
    const cpu = process.cpuUsage();
    const nextTimer = new Promise<number>((resolve) =>
      setTimeout(() => resolve(performance.now() - started), 0),
    );
    const response = handler(db, "benchmark");
    const bytes = (await response.arrayBuffer()).byteLength;
    const elapsedMs = performance.now() - started;
    const timerDelayMs = await nextTimer;
    const usedCpu = process.cpuUsage(cpu);
    console.log(
      JSON.stringify({
        name,
        elapsedMs: Math.round(elapsedMs * 100) / 100,
        timerDelayMs: Math.round(timerDelayMs * 100) / 100,
        bytes,
        cpuMs: Math.round((usedCpu.user + usedCpu.system) / 1000),
        rssMiB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      }),
    );
  }
} finally {
  db.close();
}
