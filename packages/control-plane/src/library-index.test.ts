import { describe, expect, test } from "vitest";
import * as Schema from "effect/Schema";
import type { LibrarySnapshot } from "./domain/library";
import { LibraryIndexPage, libraryIndexPage } from "./library-index";

const snapshot: LibrarySnapshot = {
  generatedAt: "2026-10-20T00:00:00Z",
  counts: { total: 123, active: 123, library: 0, draft: 0, archived: 0 },
  skills: Array.from({ length: 123 }, (_, index) => ({
    skillId: `skill-${index}`,
    name: `skill-${index}`,
    lifecycle: "active",
    origins: [],
    updateStatus: "unknown",
    lastUsedAt: null,
    lastModifiedAt: "2026-10-20T00:00:00Z",
    revisions: [],
    locations: ["first", "last"].map((part) => ({
      sourceKind: "installed",
      packagePath: `/projects/${part}/${index}`,
      skillPath: `/projects/${part}/${index}/SKILL.md`,
      harness: "codex",
      scope: "project",
      projectRoot: `/projects/${part}`,
      active: part === "last",
      modifiedAt: "2026-10-20T00:00:00Z",
      lastUsedAt: null,
      origin: null,
      updateStatus: "unknown",
    })),
  })),
};

describe("library index", () => {
  test.each([100, 1000, 10000])(
    "bounds generated %i-skill pages while retaining the full inventory",
    (count) => {
      const template = snapshot.skills[0];
      if (!template) throw new Error("Fixture skill missing");
      const generated: LibrarySnapshot = {
        ...snapshot,
        counts: { ...snapshot.counts, total: count, active: count },
        skills: Array.from({ length: count }, (_, index) => ({
          ...template,
          skillId: `skill-${index}`,
          name: `skill-${index}`,
        })),
      };
      const ids = new Set<string>();
      for (let offset = 0; offset < count; offset += 50) {
        const page = libraryIndexPage(generated, { offset, limit: 50, search: "" });
        expect(page.skills.length).toBeLessThanOrEqual(50);
        expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThan(250_000);
        for (const skill of page.skills) ids.add(skill.skillId);
      }
      expect(ids.size).toBe(count);
      const last = libraryIndexPage(generated, {
        offset: 0,
        limit: 50,
        search: `skill-${count - 1}`,
      });
      expect(last.skills.map((skill) => skill.skillId)).toEqual([`skill-${count - 1}`]);
    },
  );
  test("pages beyond 100 skills without losing or duplicating any skill", () => {
    const pages = [0, 50, 100].map((offset) =>
      Schema.decodeUnknownSync(LibraryIndexPage)(
        libraryIndexPage(snapshot, { offset, limit: 50, search: "" }),
      ),
    );
    expect(pages.map((page) => page.skills.length)).toEqual([50, 50, 23]);
    expect(pages.map((page) => page.nextOffset)).toEqual([50, 100, null]);
    expect(pages.flatMap((page) => page.skills.map((skill) => skill.skillId))).toEqual(
      snapshot.skills.map((skill) => skill.skillId),
    );
    expect(pages.every((page) => page.total === 123 && page.counts.total === 123)).toBe(true);
  });
  test("searches all original paths and category terms before paging", () => {
    const byPath = libraryIndexPage(snapshot, { offset: 0, limit: 50, search: "/last/122" });
    expect(byPath.skills.map((skill) => skill.skillId)).toEqual(["skill-122"]);
    const classified = libraryIndexPage(snapshot, {
      offset: 0,
      limit: 50,
      search: "MARKETING",
      classificationText: new Map([["skill-121", "Product & Business marketing"]]),
    });
    expect(classified.skills.map((skill) => skill.skillId)).toEqual(["skill-121"]);
  });
  test("projects representative connections, not incomplete revision or location graphs", () => {
    const original = JSON.stringify(snapshot);
    const page = libraryIndexPage(snapshot, { offset: 0, limit: 1, search: "" });
    expect(page.skills[0]?.connections).toHaveLength(1);
    expect(page.skills[0]?.connections[0]).toMatchObject({
      packagePath: "/projects/first/0",
      removable: true,
    });
    expect(page.skills[0]).not.toHaveProperty("locations");
    expect(page.skills[0]).not.toHaveProperty("revisions");
    expect(page.skills[0]?.installedCount).toBe(2);
    expect(JSON.stringify(snapshot)).toBe(original);
  });
});
