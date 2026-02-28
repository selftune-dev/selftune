#!/usr/bin/env bun
/**
 * Structural linter enforcing selftune architecture rules.
 *
 * Checks:
 * 1. Hook modules must not import from grading/eval modules
 * 2. Ingestor modules must not import from grading/eval modules
 */

import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

const HOOK_FILES = new Set(["prompt-log.ts", "session-stop.ts", "skill-eval.ts"]);
const INGESTOR_FILES = new Set(["codex-wrapper.ts", "codex-rollout.ts", "opencode-ingest.ts"]);

const FORBIDDEN_IMPORTS = ["grade-session", "hooks-to-evals", "/grading/", "/eval/"];

function checkFile(filepath: string): string[] {
  const violations: string[] = [];
  const name = basename(filepath);

  if (!HOOK_FILES.has(name) && !INGESTOR_FILES.has(name)) return violations;

  const content = readFileSync(filepath, "utf-8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("import")) continue;

    for (const forbidden of FORBIDDEN_IMPORTS) {
      if (line.includes(forbidden)) {
        violations.push(
          `${filepath}:${i + 1}: imports '${forbidden}' (violates dependency direction)`,
        );
      }
    }
  }

  return violations;
}

function findTsFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findTsFiles(path));
      } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
        files.push(path);
      }
    }
  } catch {
    // directory doesn't exist
  }
  return files;
}

const violations: string[] = [];
for (const file of findTsFiles("cli/selftune").sort()) {
  violations.push(...checkFile(file));
}

if (violations.length > 0) {
  console.log("Architecture violations found:");
  for (const v of violations) {
    console.log(`  ${v}`);
  }
  process.exit(1);
} else {
  console.log("No architecture violations found.");
  process.exit(0);
}
