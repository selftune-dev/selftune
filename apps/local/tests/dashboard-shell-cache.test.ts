import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "@selftune/local-store";
import { handleDashboardShell } from "../src/routes/overview";

test("shell cache observes writes on its own connection and other connections", async () => {
  const root = mkdtempSync(join(tmpdir(), "shell-cache-"));
  const path = join(root, "test.db");
  const db = openDb(path);
  const writer = openDb(path);
  try {
    const initial = await handleDashboardShell(db, "1").json();
    expect(await handleDashboardShell(db, "1").json()).toEqual(initial);
    db.run(
      "INSERT INTO evolution_audit (timestamp, skill_name, action, proposal_id) VALUES (?, ?, ?, ?)",
      ["2026-09-11", "one", "deployed", "one"],
    );
    expect((await handleDashboardShell(db, "1").json()).latest_evolutions).toHaveLength(1);
    writer.run(
      "INSERT INTO evolution_audit (timestamp, skill_name, action, proposal_id) VALUES (?, ?, ?, ?)",
      ["2026-09-12", "two", "deployed", "two"],
    );
    expect((await handleDashboardShell(db, "1").json()).latest_evolutions).toHaveLength(2);
    expect((await handleDashboardShell(db, "2").json()).version).toBe("2");
  } finally {
    writer.close();
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});
