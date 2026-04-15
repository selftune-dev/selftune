import { describe, expect, it } from "vitest";

import { normalizeLifecycleCommand, normalizeLifecycleText } from "./lifecycle-surface";

describe("dashboard lifecycle-surface", () => {
  it("normalizes stage-level commands into lifecycle commands", () => {
    expect(
      normalizeLifecycleCommand(
        "selftune create replay --skill-path /tmp/Taxes/SKILL.md --mode package",
      ),
    ).toBe("selftune verify --skill-path /tmp/Taxes/SKILL.md --mode package");
    expect(
      normalizeLifecycleCommand(
        "selftune create baseline --skill-path /tmp/Taxes/SKILL.md --mode package",
      ),
    ).toBe("selftune verify --skill-path /tmp/Taxes/SKILL.md --mode package");
    expect(
      normalizeLifecycleCommand(
        "selftune evolve body --skill Taxes --skill-path /tmp/Taxes/SKILL.md",
      ),
    ).toBe("selftune improve --scope body --skill Taxes --skill-path /tmp/Taxes/SKILL.md");
    expect(
      normalizeLifecycleCommand(
        "selftune search-run --skill Taxes --skill-path /tmp/Taxes/SKILL.md",
      ),
    ).toBe("selftune improve --scope package --skill Taxes --skill-path /tmp/Taxes/SKILL.md");
  });

  it("normalizes stage-level status text into lifecycle language", () => {
    expect(normalizeLifecycleText("Run create replay before publishing.")).toBe(
      "Run verify before publishing.",
    );
    expect(normalizeLifecycleText("Run create baseline after create replay.")).toBe(
      "Run verify after verify.",
    );
    expect(normalizeLifecycleText("Use evolve body if execution quality is weak.")).toBe(
      "Use improve --scope body if execution quality is weak.",
    );
    expect(normalizeLifecycleText("search-run found the best package candidate")).toBe(
      "improve --scope package found the best package candidate",
    );
  });
});
