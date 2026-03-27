/**
 * Guards the publish pipeline for @selftune/telemetry-contract.
 *
 * In development, package.json uses workspace:* so the lockfile stays clean.
 * At publish time, prepack rewrites it to file: so npm/bun can install from
 * the registry. postpack restores workspace:* afterward.
 *
 * This test exists because coding agents repeatedly break this setup —
 * either by removing the prepack/postpack scripts or by hardcoding file:
 * in package.json (which causes duplicate lockfile entries).
 */

import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");

describe("publish dependency protocol", () => {
  test("root package.json uses workspace:* for telemetry-contract in dev", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    const spec = pkg.dependencies?.["@selftune/telemetry-contract"];

    if (spec !== "workspace:*") {
      throw new Error(
        `dependencies.@selftune/telemetry-contract must be "workspace:*" in the repo (prepack rewrites to file: at publish time). Got: ${spec}. Next: edit package.json and run bun test tests/trust-floor/publish-deps.test.ts`,
      );
    }
  });

  test("prepack script exists and rewrites workspace:* to file:", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));

    if (!pkg.scripts?.prepack?.includes("publish-package-json.cjs")) {
      throw new Error(
        `Missing prepack script in package.json. Must run "node scripts/publish-package-json.cjs prepare". Next: restore the prepack script and run bun test tests/trust-floor/publish-deps.test.ts`,
      );
    }
    if (!pkg.scripts?.postpack?.includes("publish-package-json.cjs")) {
      throw new Error(
        `Missing postpack script in package.json. Must run "node scripts/publish-package-json.cjs restore". Next: restore the postpack script and run bun test tests/trust-floor/publish-deps.test.ts`,
      );
    }
  });

  test("publish-package-json.cjs script file exists", () => {
    const scriptPath = join(ROOT, "scripts/publish-package-json.cjs");
    if (!existsSync(scriptPath)) {
      throw new Error(
        `Missing scripts/publish-package-json.cjs. This script rewrites workspace:* to file: at publish time. Next: restore the script and run bun test tests/trust-floor/publish-deps.test.ts`,
      );
    }
  });

  test("prepack rewrite produces file: protocol", () => {
    // Run the prepare step, check the result, then restore
    execSync("node scripts/publish-package-json.cjs prepare", { cwd: ROOT });
    try {
      const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
      const spec = pkg.dependencies?.["@selftune/telemetry-contract"];
      if (typeof spec !== "string" || !spec.startsWith("file:")) {
        throw new Error(
          `After prepack, dependencies.@selftune/telemetry-contract must start with file:. Got: ${spec}. Next: fix scripts/publish-package-json.cjs and run bun test tests/trust-floor/publish-deps.test.ts`,
        );
      }
    } finally {
      execSync("node scripts/publish-package-json.cjs restore", { cwd: ROOT });
    }
  });
});
