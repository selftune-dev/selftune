import { describe, expect, test } from "vitest";
import * as Schema from "effect/Schema";
import {
  CompactLibrarySnapshot,
  compactLibrarySnapshot,
  expandLibrarySnapshot,
} from "./library-transport";
import type { LibrarySnapshot } from "./domain/library";

const location = {
  sourceKind: "installed",
  packagePath: "/skills/test",
  skillPath: "/skills/test/SKILL.md",
  harness: "codex",
  scope: "global",
  projectRoot: null,
  active: true,
  modifiedAt: "2026-10-20T00:00:00Z",
  lastUsedAt: null,
  origin: null,
  updateStatus: "unknown",
} satisfies LibrarySnapshot["skills"][number]["locations"][number];
const snapshot: LibrarySnapshot = {
  generatedAt: "2026-10-20T00:00:00Z",
  counts: { total: 1, active: 1, library: 0, draft: 0, archived: 0 },
  skills: [
    {
      skillId: "test",
      name: "test",
      lifecycle: "active",
      origins: [],
      updateStatus: "unknown",
      lastUsedAt: null,
      lastModifiedAt: "2026-10-20T00:00:00Z",
      locations: [location],
      revisions: [{ contentHash: "hash", locations: [{ ...location }] }],
    },
  ],
};

describe("library transport", () => {
  test("round trips all fields and preserves revision/location identity", () => {
    const compact = Schema.decodeUnknownSync(CompactLibrarySnapshot)(
      JSON.parse(JSON.stringify(compactLibrarySnapshot(snapshot))),
    );
    expect(compact.locations).toHaveLength(1);
    const expanded = expandLibrarySnapshot(compact);
    expect(expanded).toEqual(snapshot);
    expect(expanded.skills[0]?.locations[0]).toBe(expanded.skills[0]?.revisions[0]?.locations[0]);
  });
  test("does not merge different revisions at the same path", () => {
    const skill = snapshot.skills[0];
    if (!skill) throw new Error("Fixture skill missing");
    const changed = {
      ...snapshot,
      skills: [
        {
          ...skill,
          revisions: [{ contentHash: "older", locations: [{ ...location, active: false }] }],
        },
      ],
    };
    expect(compactLibrarySnapshot(changed).locations).toHaveLength(2);
    expect(expandLibrarySnapshot(compactLibrarySnapshot(changed))).toEqual(changed);
  });
  test("rejects dangling, negative and non-integer references", () => {
    const compact = compactLibrarySnapshot(snapshot);
    expect(() => expandLibrarySnapshot({ ...compact, locations: [] })).toThrow(
      "invalid location reference",
    );
    const skill = compact.skills[0];
    expect(() =>
      Schema.decodeUnknownSync(CompactLibrarySnapshot)({
        ...compact,
        skills: [{ ...skill, locations: [-1] }],
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(CompactLibrarySnapshot)({
        ...compact,
        skills: [{ ...skill, locations: [0.5] }],
      }),
    ).toThrow();
  });
});
