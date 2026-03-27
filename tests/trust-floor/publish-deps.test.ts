/**
 * Guards against workspace:* protocol in published package.json dependencies.
 *
 * npm and bun cannot install packages from the registry that use workspace:*
 * in their dependency specs. selftune must use file: protocol for local
 * packages that ship with the published tarball.
 *
 * This test exists because coding agents repeatedly "fix" file: back to
 * workspace:*, which breaks every `npm install selftune` / `bun add selftune`.
 */

import { describe, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");

describe("publishable dependency protocols", () => {
  test("root package.json must not use workspace: protocol in dependencies", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    const deps = pkg.dependencies ?? {};

    for (const [name, spec] of Object.entries(deps)) {
      if (typeof spec !== "string") {
        throw new Error(
          `Invalid dependencies.${name}: expected string spec. Next: bun test tests/trust-floor/publish-deps.test.ts`,
        );
      }
      if (spec.startsWith("workspace:")) {
        throw new Error(
          `Disallowed protocol in dependencies.${name}=${spec}. Use file:... Next: bun test tests/trust-floor/publish-deps.test.ts`,
        );
      }
    }
  });

  test("@selftune/telemetry-contract must use file: protocol", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    const spec = pkg.dependencies?.["@selftune/telemetry-contract"];

    if (typeof spec !== "string" || !spec.startsWith("file:")) {
      throw new Error(
        `dependencies.@selftune/telemetry-contract must start with file:. Got: ${spec}. Next: bun test tests/trust-floor/publish-deps.test.ts`,
      );
    }
  });
});
