import { afterEach, describe, expect, it, vi } from "vitest";

import { localHostAdapter } from "./dashboard-host";

describe("localHostAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists the overview watchlist through the local dashboard server", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ watched_skills: ["selftune", "playwright-cli"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await localHostAdapter.actions.updateOverviewWatchlist?.([
      "selftune",
      "playwright-cli",
    ]);

    expect(result).toEqual(["selftune", "playwright-cli"]);
    expect(fetchMock).toHaveBeenCalledWith("/api/actions/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skills: ["selftune", "playwright-cli"] }),
    });
  });
});
