import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseRolloutFile,
  buildCanonicalRecordsFromRollout,
} from "@selftune/harness-codex/ingestors/codex-rollout";
import { createSkillReadEvidenceCollector } from "../../packages/harnesses/codex/src/ingestors/skill-read-evidence";

test("retains desktop output provenance and rejects multi-skill ambiguity", () => {
  const collector = createSkillReadEvidenceCollector();
  collector.customCall("a", 'text(await tools.exec_command({cmd:"cat /a/sample/SKILL.md"}));');
  collector.output("a", "wrapped output", 6);
  expect(collector.reads[0]?.version_scope).toBe("captured_tool_output");
  collector.customCall("b", "cat /a/sample/SKILL.md /b/other/SKILL.md");
  collector.output("b", "ambiguous", 8);
  expect(collector.reads).toHaveLength(1);
});

test("retains historical read provenance without inventing a package revision", () => {
  const root = mkdtempSync(join(tmpdir(), "codex-version-"));
  try {
    const path = join(root, "rollout.jsonl");
    writeFileSync(
      path,
      [
        { type: "session_meta", payload: { id: "evidence-test", cwd: "/project" } },
        {
          type: "event_msg",
          payload: { type: "user_message", message: "Use sample to review this project" },
        },
        {
          type: "response_item",
          payload: {
            type: "function_call",
            name: "exec_command",
            call_id: "r1",
            arguments: JSON.stringify({ cmd: "cat /project/skills/sample/SKILL.md" }),
          },
        },
        {
          type: "response_item",
          payload: {
            type: "function_call_output",
            call_id: "r1",
            output: "Historical instructions, not today's installed file.",
          },
        },
      ]
        .map((event) => JSON.stringify(event))
        .join("\n"),
    );
    const parsed = parseRolloutFile(path, new Set(["sample"]));
    expect(parsed).not.toBeNull();
    if (!parsed) throw new Error("Expected parsed fixture");
    const invocation = buildCanonicalRecordsFromRollout(parsed).find(
      (r) => r.record_kind === "skill_invocation",
    );
    expect(invocation?.skill_path).toBe("/project/skills/sample/SKILL.md");
    expect(invocation?.skill_version_hash).toBeUndefined();
    expect(invocation?.raw_source_ref.metadata?.package_version_status).toBe("unknown");
    expect(parsed.skill_reads?.[0]?.output_line).toBe(4);
    expect(parsed.skill_reads?.[0]?.output_sha256).toHaveLength(64);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("does not associate compound command output or unmatched outputs with a skill", () => {
  const collector = createSkillReadEvidenceCollector();
  collector.call(
    "a",
    "exec_command",
    JSON.stringify({ cmd: "cat /a/sample/SKILL.md; echo other" }),
  );
  collector.output("a", "mixed output", 1);
  collector.output("missing", "unrelated", 2);
  expect(collector.reads).toEqual([]);
});

test("retains distinct reads rather than choosing a single historical version", () => {
  const collector = createSkillReadEvidenceCollector();
  for (const id of ["a", "b"]) {
    collector.call(id, "Read", JSON.stringify({ file_path: "/a/sample/SKILL.md" }));
    collector.output(id, id, 3);
  }
  expect(collector.reads).toHaveLength(2);
  expect(collector.reads[0]?.output_sha256).not.toBe(collector.reads[1]?.output_sha256);
});
