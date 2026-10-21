// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { LibrarySnapshot } from "./types";
import { libraryIndexPage } from "@selftune/control-plane/library-index";
import { useLocalLibraryInventory } from "./use-local-library-inventory";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const location = {
  sourceKind: "installed",
  packagePath: "/projects/one/.agents/skills/marketing",
  skillPath: "/projects/one/.agents/skills/marketing/SKILL.md",
  harness: "codex",
  scope: "project",
  projectRoot: "/projects/one",
  active: true,
  modifiedAt: "2026-10-20T00:00:00Z",
  lastUsedAt: null,
  origin: null,
  updateStatus: "untracked",
} satisfies LibrarySnapshot["skills"][number]["locations"][number];
const snapshot: LibrarySnapshot = {
  generatedAt: "2026-10-20T00:00:00Z",
  counts: { total: 1, active: 1, library: 0, archived: 0, draft: 0 },
  skills: [
    {
      skillId: "marketing",
      name: "marketing",
      lifecycle: "active",
      origins: [],
      locations: [
        location,
        {
          ...location,
          packagePath: "/projects/two/marketing",
          skillPath: "/projects/two/marketing/SKILL.md",
        },
      ],
      revisions: [{ contentHash: "hash", locations: [location] }],
      updateStatus: "untracked",
      lastUsedAt: null,
      lastModifiedAt: location.modifiedAt,
    },
  ],
};
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const reads: URL[] = [];
  vi.stubGlobal("fetch", async (input: string) => {
    const url = new URL(input, "http://localhost");
    if (url.pathname === "/api/v2/library") {
      reads.push(url);
      return Response.json(
        url.searchParams.get("view") === "index"
          ? libraryIndexPage(snapshot, { offset: 0, limit: 50, search: "" })
          : snapshot,
      );
    }
    return Response.json({ error: "No optional report fixture" }, { status: 503 });
  });
  return { ...renderHook(() => useLocalLibraryInventory(), { wrapper }), reads };
}
describe("lazy library inventory", () => {
  it("does not request the full graph for browsing, and hydrates all selected locations", async () => {
    const hook = setup();
    await waitFor(() => expect(hook.result.current.data?.skills).toHaveLength(1));
    expect(hook.reads.every((url) => url.searchParams.get("view") === "index")).toBe(true);
    expect(hook.result.current.data?.skills[0]?.detailsLoaded).toBe(false);
    await act(async () => {
      const detail = await hook.result.current.loadDetails?.("marketing");
      expect(detail?.locations).toHaveLength(2);
      expect(detail?.contextEntries).toHaveLength(2);
    });
    expect(hook.reads.at(-1)?.searchParams.get("skill_id")).toBe("marketing");
    expect(hook.reads.at(-1)?.searchParams.get("snapshot")).toBe(snapshot.generatedAt);
    expect(hook.result.current.data?.skills[0]?.locations).toHaveLength(2);
    hook.unmount();
  });
  it("loads the complete inventory only for an explicit whole-library journey", async () => {
    const hook = setup();
    await waitFor(() => expect(hook.result.current.data?.skills).toHaveLength(1));
    await act(async () => {
      await hook.result.current.loadAll?.();
    });
    await waitFor(() => expect(hook.result.current.searchHandled).toBe(false));
    expect(
      hook.reads.some(
        (url) => url.searchParams.get("view") !== "index" && !url.searchParams.has("skill_id"),
      ),
    ).toBe(true);
    expect(hook.result.current.data?.skills[0]?.locations).toHaveLength(2);
    hook.unmount();
  });
});
