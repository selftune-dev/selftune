import { describe, expect, test } from "bun:test";

import { runHistoricalSkillImproveCli } from "../src/historical-skill-improve-cli.js";

describe("historical skill improve CLI spend preflight", () => {
  test("rejects invalid amounts before opening stores or starting model work", async () => {
    await expect(
      runHistoricalSkillImproveCli({
        skill: "to-issues",
        skillPath: "/tmp/skills/to-issues/SKILL.md",
        budgetRemainingUsd: -1,
        estimatedCostUsd: 0,
      }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });

    await expect(
      runHistoricalSkillImproveCli({
        skill: "to-issues",
        skillPath: "/tmp/skills/to-issues/SKILL.md",
        budgetRemainingUsd: 1,
        estimatedCostUsd: Number.POSITIVE_INFINITY,
      }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });

  test("rejects an over-budget total-run estimate before opening stores or starting model work", async () => {
    await expect(
      runHistoricalSkillImproveCli({
        skill: "to-issues",
        skillPath: "/tmp/skills/to-issues/SKILL.md",
        budgetRemainingUsd: 1,
        estimatedCostUsd: 1.01,
      }),
    ).rejects.toMatchObject({
      code: "GUARD_BLOCKED",
      message: expect.stringContaining("Historical replay was not started"),
    });
  });
});
