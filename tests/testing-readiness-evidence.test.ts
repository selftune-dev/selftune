import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "@selftune/local-store";
import { listSkillTestingReadiness } from "../packages/runtime/testing-readiness";

test("readiness keeps the latest valid evidence count when newer evidence is malformed or empty", () => {
  const root = mkdtempSync(join(tmpdir(), "selftune-readiness-evidence-"));
  const previous = process.env.SELFTUNE_CONFIG_DIR;
  process.env.SELFTUNE_CONFIG_DIR = root;
  const db = openDb(":memory:");
  try {
    const insert = db.prepare(
      "INSERT INTO evolution_evidence (timestamp, proposal_id, skill_name, skill_path, eval_set_json) VALUES (?, ?, 'readiness-evidence', '/missing/SKILL.md', ?)",
    );
    insert.run(
      "2026-10-01",
      "valid",
      JSON.stringify([{ query: "real task", should_trigger: true }]),
    );
    insert.run("2026-10-02", "empty", "[]");
    insert.run("2026-10-03", "malformed", "{broken");
    insert.run("2026-10-04", "mixed", '[{"query":"task"},42]');
    const row = listSkillTestingReadiness(db, []).find(
      (entry) => entry.skill_name === "readiness-evidence",
    );
    expect(row?.eval_set_entries).toBe(1);
    expect(row?.latest_eval_at).toBe("2026-10-01");
  } finally {
    db.close();
    if (previous === undefined) delete process.env.SELFTUNE_CONFIG_DIR;
    else process.env.SELFTUNE_CONFIG_DIR = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
