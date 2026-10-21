import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Semaphore from "effect/Semaphore";
import { computeReportInWorker } from "../src/report-compute";

const fixture = join(import.meta.dir, "fixtures", "report-worker.ts");

test("report interruption reaps a real worker before deleting its artifact", async () => {
  const root = mkdtempSync(join(tmpdir(), "selftune-worker-cancel-"));
  const pidPath = join(root, "worker.pid");
  const ready = async () => {
    while (!existsSync(pidPath)) await new Promise<void>((resolve) => setImmediate(resolve));
    return Number(readFileSync(pidPath, "utf8"));
  };
  const fiber = Effect.runFork(
    computeReportInWorker("portfolio-audit", { configRoot: root }, root, {
      command: [process.execPath, fixture, "uncooperative"],
    }),
  );
  try {
    const pid = await ready();
    expect(pid).toBeGreaterThan(0);
    await Effect.runPromise(Fiber.interrupt(fiber));
    expect(() => process.kill(pid, 0)).toThrow();
    expect(readdirSync(root)).toEqual(["worker.pid"]);
  } finally {
    await Effect.runPromise(Fiber.interrupt(fiber));
    rmSync(root, { recursive: true, force: true });
  }
});

test("queued reports do not spawn until a host-owned permit is available", async () => {
  const root = mkdtempSync(join(tmpdir(), "selftune-worker-permit-"));
  try {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const semaphore = yield* Semaphore.make(0);
          const fiber = yield* Effect.forkScoped(
            computeReportInWorker("portfolio-audit", { configRoot: root }, root, {
              semaphore,
              command: [process.execPath, fixture, "valid"],
            }),
          );
          yield* Effect.yieldNow;
          expect(readdirSync(root)).toEqual([]);
          yield* semaphore.release(1);
          const report = yield* Fiber.join(fiber);
          expect(report.installed_count).toBe(0);
          expect(readdirSync(root)).toEqual([]);
        }),
      ),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
