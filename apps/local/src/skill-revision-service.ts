import type { Database } from "bun:sqlite";
import { realpathSync } from "node:fs";
import { dirname } from "node:path";
import { createSkillRevisionHistory } from "@selftune/runtime/skill-revision-history";
import { findInstalledSkillPackages } from "@selftune/runtime/utils/skill-discovery";
import { Schema } from "effect";
import { sameOriginFailure } from "./dashboard-http.js";
import {
  installedSkillPathsForSelection,
  installedSkillSearchDirs,
} from "./installed-skill-discovery.js";

const RestoreBody = Schema.Struct({
  path: Schema.String,
  revision: Schema.Number,
  expectedHash: Schema.String,
});

export function createSkillRevisionService(
  database: Database,
  configRoot: string,
  options: {
    paths?: () => string[];
    onChange?: () => void;
    onError?: (message: string) => void;
  } = {},
) {
  const history = createSkillRevisionHistory(database, configRoot);
  const searchDirs = () => installedSkillSearchDirs(database);
  function* pathGroups() {
    if (options.paths) {
      yield options.paths();
      return;
    }
    for (const directory of searchDirs())
      yield findInstalledSkillPackages([directory]).map((skill) => skill.package_path);
  }
  const pending = new Map<string, string>();
  const captured = new Map<string, string>();
  const failures = new Map<string, string>();
  const installed = () => {
    const roots = new Set<string>();
    for (const paths of pathGroups())
      for (const path of paths) {
        try {
          roots.add(realpathSync(path));
        } catch {
          // A package may disappear between discovery and capture.
        }
      }
    return roots;
  };
  const authorize = (path: string) => {
    const root = realpathSync(path);
    if (!options.paths) {
      if (installedSkillPathsForSelection(database, path).length) return root;
      throw new Error("Select an installed skill package.");
    }
    if (!installed().has(root)) throw new Error("Select an installed skill package.");
    return root;
  };
  function* scanPackages() {
    let changed = false;
    const roots = new Set<string>();
    try {
      for (const paths of pathGroups()) {
        yield;
        for (const path of paths) {
          yield;
          let root: string;
          try {
            root = realpathSync(path);
          } catch {
            continue;
          }
          if (roots.has(root)) continue;
          roots.add(root);
          try {
            const hash = history.fingerprint(root);
            if (
              !captured.has(root) ||
              (captured.get(root) !== hash && pending.get(root) === hash)
            ) {
              const revision = history.capture(root);
              captured.set(root, revision.content_hash);
              changed = true;
            }
            pending.set(root, hash);
            failures.delete(root);
          } catch (error) {
            pending.delete(root);
            const message = error instanceof Error ? error.message : String(error);
            if (failures.get(root) !== message) options.onError?.(`${root}: ${message}`);
            failures.set(root, message);
          }
        }
      }
    } catch (error) {
      options.onError?.(String(error));
      return;
    }
    for (const root of captured.keys())
      if (!roots.has(root)) {
        captured.delete(root);
        pending.delete(root);
        failures.delete(root);
      }
    if (changed) options.onChange?.();
  }
  const scan = () => {
    for (const _ of scanPackages()) {
      /* Explicit scans complete synchronously. */
    }
  };
  let timer: ReturnType<typeof setInterval> | undefined;
  let scanning = false;
  let generation = 0;
  const scanInBackground = async () => {
    if (scanning) return;
    scanning = true;
    const started = generation;
    try {
      for (const _ of scanPackages()) {
        await new Promise<void>((resolve) => setImmediate(resolve));
        if (generation !== started) return;
      }
    } finally {
      scanning = false;
    }
  };
  return {
    scan,
    start: () => {
      if (!timer) {
        void scanInBackground();
        timer = setInterval(() => void scanInBackground(), 5_000);
        timer.unref();
      }
    },
    stop: () => {
      generation += 1;
      if (timer) clearInterval(timer);
      timer = undefined;
    },
    handle: async (
      request: Request,
      url: URL,
      allowedOrigins: ReadonlySet<string>,
    ): Promise<Response | null> => {
      if (url.pathname !== "/api/v2/skill-history") return null;
      try {
        if (request.method === "POST") {
          const forbidden = sameOriginFailure(request, allowedOrigins);
          if (forbidden) return forbidden;
          const input = Schema.decodeUnknownSync(RestoreBody)(await request.json());
          if (!Number.isSafeInteger(input.revision) || input.revision < 1)
            throw new Error("Invalid revision.");
          const revision = history.restore(
            authorize(input.path),
            input.revision,
            input.expectedHash,
          );
          options.onChange?.();
          return Response.json(revision);
        }
        if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
        const path = url.searchParams.get("path");
        if (!path) throw new Error("Select a skill path.");
        const root = authorize(dirname(path));
        const revision = url.searchParams.get("revision");
        if (revision) {
          const number = Number(revision);
          if (!Number.isSafeInteger(number) || number < 1) throw new Error("Invalid revision.");
          return Response.json({ files: history.diff(root, number) });
        }
        const before = Number(url.searchParams.get("before") ?? Number.MAX_SAFE_INTEGER);
        if (!Number.isSafeInteger(before) || before < 1) throw new Error("Invalid history cursor.");
        history.capture(root);
        return Response.json({ revisions: history.list(root, before) });
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Skill history failed." },
          { status: 400 },
        );
      }
    },
  };
}
