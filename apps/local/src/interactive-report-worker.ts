import { join } from "node:path";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Exit from "effect/Exit";
import {
  computeReportInWorker,
  type ReportComputeOptions,
  type ReportWorkerProcessOptions,
} from "./report-compute.js";

/** One active request per report route; identical reads share the serialized result. */
export function createInteractiveReportWorker(
  report: "overview" | "skill-report" | "shell" | "analytics",
  options: ReportComputeOptions,
  reportsDir: string,
  processOptions: ReportWorkerProcessOptions = {},
  readDatabaseVersion?: () => string,
) {
  let closed = false;
  let cachedDatabaseReply: { key: string; status: number; body: string } | undefined;
  let active:
    | {
        key: string;
        result: Promise<{ status: number; body: string } | null>;
        cancel: () => Promise<void>;
      }
    | undefined;
  const handle = async (identity: string, searchParams: URLSearchParams): Promise<Response> => {
    if (closed) return Response.json({ error: "Dashboard is shutting down" }, { status: 503 });
    const search = searchParams.toString();
    if (search.length > 8192 || identity.length > 512)
      return Response.json({ error: "Report query is too large" }, { status: 400 });
    const dataVersion =
      report === "shell" || report === "analytics" ? readDatabaseVersion?.() : undefined;
    const key = JSON.stringify([identity, search, dataVersion]);
    if (cachedDatabaseReply?.key === key)
      return new Response(cachedDatabaseReply.body, {
        status: cachedDatabaseReply.status,
        headers: { "Content-Type": "application/json" },
      });
    if (active && active.key !== key) {
      return Response.json(
        { error: "Report computation is busy; retry shortly" },
        {
          status: 503,
          headers: { "Retry-After": "1" },
        },
      );
    }
    if (!active) {
      const fiber = Effect.runFork(
        computeReportInWorker(
          report,
          {
            ...options,
            ...(report === "shell"
              ? { shell: { version: identity } }
              : report === "overview"
                ? { overview: { version: identity, search } }
                : report === "skill-report"
                  ? { skillReport: { skillName: identity, search } }
                  : {}),
          },
          join(reportsDir, report),
          processOptions,
        ).pipe(
          Effect.tapError(() => Effect.logError(`${report} worker failed`)),
          Effect.match({
            onSuccess: (json) => json,
            onFailure: () => null,
          }),
        ),
      );
      const result = Effect.runPromise(Fiber.await(fiber)).then((exit) =>
        Exit.isSuccess(exit) ? exit.value : null,
      );
      active = { key, result, cancel: () => Effect.runPromise(Fiber.interrupt(fiber)) };
    }
    const pending = active;
    try {
      const json = await pending.result;
      if (
        json?.status === 200 &&
        dataVersion !== undefined &&
        readDatabaseVersion?.() === dataVersion
      )
        cachedDatabaseReply = { key, ...json };
      return json === null
        ? Response.json(
            { error: "Report worker failed; retry shortly" },
            { status: 503, headers: { "Retry-After": "1" } },
          )
        : new Response(json.body, {
            status: json.status,
            headers: { "Content-Type": "application/json" },
          });
    } finally {
      if (active === pending) active = undefined;
    }
  };
  return Object.assign(handle, {
    close: async () => {
      closed = true;
      await active?.cancel();
    },
  });
}
