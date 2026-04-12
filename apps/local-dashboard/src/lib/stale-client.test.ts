import { describe, expect, it } from "vitest";

import { detectStaleClient } from "./stale-client";

const client = {
  version: "0.2.22",
  buildId: "0.2.22",
};

describe("detectStaleClient", () => {
  it("returns null when server and client match", () => {
    expect(
      detectStaleClient(
        {
          ok: true,
          service: "selftune-dashboard",
          version: "0.2.22",
          spa_build_id: "0.2.22",
        },
        client,
      ),
    ).toBeNull();
  });

  it("falls back to the server version when the build id is missing", () => {
    expect(
      detectStaleClient(
        {
          ok: true,
          service: "selftune-dashboard",
          version: "0.2.22",
        },
        client,
      ),
    ).toBeNull();
  });

  it("flags a stale client when the server version changes", () => {
    expect(
      detectStaleClient(
        {
          ok: true,
          service: "selftune-dashboard",
          version: "0.2.23",
          spa_build_id: "0.2.23",
        },
        client,
      ),
    ).toEqual({
      serverVersion: "0.2.23",
      serverBuildId: "0.2.23",
    });
  });
});
