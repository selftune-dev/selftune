import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { changedPaths, isDocsOnly, selectPolicy } from "./ci-policy.mjs";

for (const paths of [
  ["README.md"],
  ["apps/desktop/README.md"],
  ["docs/image.png", "docs/setup.md"],
]) {
  test(`documentation skips heavy PR jobs: ${paths.join(", ")}`, () => {
    assert.equal(isDocsOnly(paths), true);
    assert.equal(selectPolicy("pull_request", paths).run_heavy, false);
  });
}
for (const paths of [
  [],
  ["package.json"],
  ["docs/setup.md", "apps/local/main.ts"],
  [".github/scripts/ci-policy.mjs"],
]) {
  test(`code or unknown changes run PR jobs: ${paths.join(", ")}`, () => {
    assert.equal(selectPolicy("pull_request", paths).run_heavy, true);
  });
}
test("PRs keep Linux and Windows, while merge, push and release retain all platforms", () => {
  assert.deepEqual(
    selectPolicy("pull_request", ["apps/desktop/main.ts"]).desktop_matrix.include.map(
      (target) => target.platform,
    ),
    ["linux", "win"],
  );
  for (const event of ["push", "merge_group", "workflow_dispatch", "release"]) {
    const policy = selectPolicy(event, ["README.md"]);
    assert.equal(policy.run_heavy, true);
    assert.deepEqual(
      policy.desktop_matrix.include.map((target) => target.platform),
      ["mac", "mac", "linux", "win"],
    );
  }
});
test("renames out of source, deleted code and newline names cannot masquerade as docs", () => {
  const root = mkdtempSync(join(tmpdir(), "selftune-ci-policy-"));
  const git = (...args) =>
    execFileSync(
      "git",
      ["-c", "user.name=CI fixture", "-c", "user.email=ci@example.invalid", ...args],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  try {
    git("init", "-b", "main");
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "source.js"), "source");
    writeFileSync(join(root, "delete.js"), "delete");
    git("add", ".");
    git("commit", "-m", "base");
    const base = git("rev-parse", "HEAD");
    renameSync(join(root, "source.js"), join(root, "docs/source.md"));
    rmSync(join(root, "delete.js"));
    writeFileSync(join(root, "code\nname.js"), "code");
    git("add", ".");
    git("commit", "-m", "changes");
    const paths = changedPaths({ pull_request: { base: { sha: base } } }, root);
    assert.deepEqual(
      new Set(paths),
      new Set(["source.js", "delete.js", "docs/source.md", "code\nname.js"]),
    );
    assert.equal(isDocsOnly(paths), false);
    assert.throws(
      () => changedPaths({ pull_request: { base: { sha: "--bad" } } }, root),
      /full PR base/,
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

// Temporary fault probe: this branch must never merge.
test("deliberate selector failure verifies the required gate", () => {
  throw new Error("Intentional CI fault probe; close this PR without merging");
});
