import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import { runImprove } from "@selftune/orchestration/improve";

const ORIGINAL_ARGV = [...process.argv];
let tempRoot = "";

afterEach(() => {
  process.argv = [...ORIGINAL_ARGV];
  if (tempRoot) {
    rmSync(tempRoot, { recursive: true, force: true });
    tempRoot = "";
  }
});

describe("selftune improve", () => {
  test("uses historical replay for an eligible auto dry-run and stops before evolve", async () => {
    let historicalInput: unknown;
    let evolved = false;
    const originalLog = console.log;
    console.log = () => undefined;
    try {
      await runImprove(
        [
          "--skill",
          "to-issues",
          "--skill-path",
          "/tmp/skills/to-issues/SKILL.md",
          "--scope",
          "auto",
          "--dry-run",
          "--agent",
          "codex",
          "--budget-remaining-usd",
          "20.00",
          "--estimated-cost-usd=5",
        ],
        {
          historicalImprove: async (input) => {
            historicalInput = input;
            return { handled: true, result: { status: "review_ready" } };
          },
          evolveCliMain: async () => {
            evolved = true;
          },
        },
      );
    } finally {
      console.log = originalLog;
    }

    expect(historicalInput).toEqual({
      skill: "to-issues",
      skillPath: "/tmp/skills/to-issues/SKILL.md",
      agent: "codex",
      budgetRemainingUsd: 20,
      estimatedCostUsd: 5,
    });
    expect(evolved).toBe(false);
  });

  test("requires explicit spend inputs before attempting historical replay", async () => {
    let historicalCalled = false;

    await expect(
      runImprove(
        [
          "--skill",
          "to-issues",
          "--skill-path",
          "/tmp/skills/to-issues/SKILL.md",
          "--scope",
          "auto",
          "--dry-run",
        ],
        {
          historicalImprove: async () => {
            historicalCalled = true;
            return { handled: true };
          },
        },
      ),
    ).rejects.toMatchObject({ code: "MISSING_FLAG" });

    expect(historicalCalled).toBe(false);
  });

  test("rejects invalid or non-finite caller spend inputs", async () => {
    let historicalCalled = false;
    for (const amount of ["-0.01", "NaN", "Infinity"]) {
      await expect(
        runImprove(
          [
            "--skill",
            "to-issues",
            "--skill-path",
            "/tmp/skills/to-issues/SKILL.md",
            "--scope",
            "auto",
            "--dry-run",
            "--budget-remaining-usd",
            "20",
            "--estimated-cost-usd",
            amount,
          ],
          {
            historicalImprove: async () => {
              historicalCalled = true;
              return { handled: true };
            },
          },
        ),
      ).rejects.toMatchObject({ code: "INVALID_FLAG" });
    }

    expect(historicalCalled).toBe(false);
  });

  test("stops before historical candidate generation when the total-run estimate exceeds remaining spend", async () => {
    let historicalCalled = false;

    await expect(
      runImprove(
        [
          "--skill",
          "to-issues",
          "--skill-path",
          "/tmp/skills/to-issues/SKILL.md",
          "--scope",
          "auto",
          "--dry-run",
          "--budget-remaining-usd",
          "2",
          "--estimated-cost-usd",
          "2.01",
        ],
        {
          historicalImprove: async () => {
            historicalCalled = true;
            return { handled: true };
          },
        },
      ),
    ).rejects.toMatchObject({
      code: "GUARD_BLOCKED",
      message: expect.stringContaining("Historical replay was not started"),
    });

    expect(historicalCalled).toBe(false);
  });

  test("falls back to description evolution when historical contrast is ineligible", async () => {
    let evolved = false;
    let evolvedArgs: string[] = [];
    await runImprove(
      [
        "--skill",
        "unused-skill",
        "--skill-path",
        "/tmp/skills/unused-skill/SKILL.md",
        "--scope",
        "auto",
        "--dry-run",
        "--budget-remaining-usd",
        "20",
        "--estimated-cost-usd",
        "5",
      ],
      {
        historicalImprove: async () => ({ handled: false }),
        evolveCliMain: async () => {
          evolved = true;
          evolvedArgs = [...process.argv];
        },
      },
    );

    expect(evolved).toBe(true);
    expect(evolvedArgs).not.toContain("--budget-remaining-usd");
    expect(evolvedArgs).not.toContain("--estimated-cost-usd");
  });

  test("delegates package scope into search-run and preserves package-evaluator flags", async () => {
    const delegatedInvocations: string[][] = [];

    process.argv = ["bun", "improve.ts"];
    await runImprove(
      [
        "--skill",
        "code-review",
        "--skill-path",
        "/tmp/code-review/SKILL.md",
        "--scope",
        "package",
        "--eval-set",
        "/tmp/evals.json",
        "--dry-run",
        "--validation-mode",
        "replay",
        "--candidates",
        "7",
      ],
      {
        searchRunCliMain: async () => {
          delegatedInvocations.push([...process.argv]);
        },
      },
    );

    expect(delegatedInvocations).toHaveLength(1);
    expect(delegatedInvocations[0]).toEqual([
      "bun",
      "improve.ts",
      "--skill",
      "code-review",
      "--skill-path",
      "/tmp/code-review/SKILL.md",
      "--eval-set",
      "/tmp/evals.json",
      "--max-candidates",
      "7",
    ]);
  });

  test("adds --apply-winner for package scope when dry-run is not requested", async () => {
    const delegatedInvocations: string[][] = [];

    process.argv = ["bun", "improve.ts"];
    await runImprove(
      ["--skill", "code-review", "--skill-path", "/tmp/code-review/SKILL.md", "--scope", "package"],
      {
        searchRunCliMain: async () => {
          delegatedInvocations.push([...process.argv]);
        },
      },
    );

    expect(delegatedInvocations).toHaveLength(1);
    expect(delegatedInvocations[0]).toEqual([
      "bun",
      "improve.ts",
      "--skill",
      "code-review",
      "--skill-path",
      "/tmp/code-review/SKILL.md",
      "--apply-winner",
    ]);
  });

  test("auto-selects package search for draft packages even without --scope package", async () => {
    const delegatedInvocations: string[][] = [];
    tempRoot = mkdtempSync(join(tmpdir(), "selftune-improve-auto-"));
    const skillDir = join(tempRoot, "research-assistant");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "# Research Assistant\n", "utf-8");
    writeFileSync(join(skillDir, "selftune.create.json"), "{}", "utf-8");

    process.argv = ["bun", "improve.ts"];
    await runImprove(
      ["--skill", "research-assistant", "--skill-path", join(skillDir, "SKILL.md")],
      {
        searchRunCliMain: async () => {
          delegatedInvocations.push([...process.argv]);
        },
      },
    );

    expect(delegatedInvocations).toHaveLength(1);
    expect(delegatedInvocations[0]).toEqual([
      "bun",
      "improve.ts",
      "--skill",
      "research-assistant",
      "--skill-path",
      join(skillDir, "SKILL.md"),
      "--apply-winner",
    ]);
  });

  test("rejects judge validation for package scope", async () => {
    await expect(
      runImprove([
        "--skill",
        "code-review",
        "--skill-path",
        "/tmp/code-review/SKILL.md",
        "--scope",
        "package",
        "--validation-mode",
        "judge",
      ]),
    ).rejects.toMatchObject({
      message: expect.stringContaining("does not support judge-only validation"),
      code: "INVALID_FLAG",
    });
  });
});
