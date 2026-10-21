import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as Schema from "effect/Schema";

test("Desktop entry dispatches reports without loading the public CLI workflow", () => {
  const root = mkdtempSync(join(tmpdir(), "selftune-shared-executable-"));
  const output = join(root, "report.json");
  try {
    const child = Bun.spawnSync(
      [
        process.execPath,
        join(import.meta.dir, "sidecar-entry.ts"),
        "__selftune_report_worker",
        "portfolio-audit",
        JSON.stringify({
          configRoot: root,
          searchDirs: [],
          storagePaths: {
            configRoot: root,
            localDatabasePath: join(root, "selftune.db"),
            localAnalyticsPath: join(root, "observability.duckdb"),
          },
        }),
        output,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    expect(child.exitCode, new TextDecoder().decode(child.stderr)).toBe(0);
    const report = Schema.decodeUnknownSync(
      Schema.fromJsonString(Schema.Struct({ installed_count: Schema.Number })),
    )(readFileSync(output, "utf8"));
    expect(report.installed_count).toBe(0);
    expect(new TextDecoder().decode(child.stdout)).toBe("");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
