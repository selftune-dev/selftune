import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLibraryIndex } from "./api";

afterEach(() => vi.unstubAllGlobals());
function page(ids: string[], nextOffset: number | null, generatedAt = "one") {
  return {
    generatedAt,
    counts: { total: 3, active: 3, library: 0, draft: 0, archived: 0 },
    total: 3,
    nextOffset,
    skills: ids.map((skillId) => ({
      skillId,
      name: skillId,
      lifecycle: "active",
      lastUsedAt: null,
      lastModifiedAt: "2026-10-20",
      updateStatus: "unknown",
      origins: [],
      connections: [],
      revisionHashes: [],
      installedCount: 0,
      consolidationAvailable: false,
    })),
  };
}
describe("library index API", () => {
  it("collects all bounded pages with a stable snapshot and passes cancellation", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(page(["a", "b"], 2)))
      .mockResolvedValueOnce(Response.json(page(["c"], null)));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    const result = await fetchLibraryIndex("a path", controller.signal);
    expect(result.skills.map((skill) => skill.skillId)).toEqual(["a", "b", "c"]);
    expect(fetch.mock.calls[1]?.[0]).toContain("snapshot=one");
    expect(fetch.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });
  it("rejects mixed snapshots, duplicate rows, and non-advancing cursors", async () => {
    for (const last of [page(["c"], null, "two"), page(["a"], null), page(["c"], 2)]) {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(Response.json(page(["a", "b"], 2)))
          .mockResolvedValueOnce(Response.json(last)),
      );
      await expect(fetchLibraryIndex("")).rejects.toThrow(/library/);
    }
  });
});
