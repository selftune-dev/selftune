import { describe, expect, it, vi } from "vitest";

import { createManagedServerProfile } from "../host/server-profiles";
import type { DashboardCloudProfileConnection } from "./types";
import { activateServerProfile, serverProfileStatusLabel } from "./ServerProfileSwitcher";

const cloudProfile = createManagedServerProfile({
  id: "cloud:selftune",
  kind: "cloud",
  name: "SelfTune Cloud",
  origin: "https://app.selftune.dev",
  authentication: { kind: "cookie" },
  capabilities: {
    analytics: false,
    registry: false,
    signals: false,
    proposals: false,
    billing: false,
    teamAdmin: false,
    runtimeStatus: false,
  },
  status: {
    state: "unreachable",
    message: "Not checked yet.",
    actionLabel: "Test server",
  },
});

function cloudConnection(
  state: DashboardCloudProfileConnection["state"],
  connect = vi.fn(async () => {}),
): DashboardCloudProfileConnection {
  return {
    state,
    connect,
    manage: vi.fn(),
    openWorkspace: vi.fn(),
    openDashboard: vi.fn(async () => {}),
  };
}

describe("sidebar Cloud profile", () => {
  it("shows account state instead of the generic server check state", () => {
    expect(serverProfileStatusLabel(cloudProfile, cloudConnection("checking"))).toBe("Checking…");
    expect(serverProfileStatusLabel(cloudProfile, cloudConnection("unlinked"))).toBe("Connect");
    expect(serverProfileStatusLabel(cloudProfile, cloudConnection("connecting"))).toBe(
      "Connecting…",
    );
    expect(serverProfileStatusLabel(cloudProfile, cloudConnection("linked"))).toBe("Connected");
    expect(serverProfileStatusLabel(cloudProfile, cloudConnection("unavailable"))).toBe("Retry");
  });

  it("links an unconnected Desktop account without leaving Desktop", async () => {
    const events: string[] = [];
    const connection = cloudConnection(
      "unlinked",
      vi.fn(async () => {
        events.push("connect");
      }),
    );
    const controller = { select: vi.fn(async () => {}) };

    await activateServerProfile(controller, cloudProfile, connection);

    expect(events).toEqual(["connect"]);
    expect(connection.openWorkspace).toHaveBeenCalledOnce();
    expect(connection.manage).not.toHaveBeenCalled();
    expect(controller.select).not.toHaveBeenCalled();
  });

  it("opens the Team workspace when the Desktop account is already linked", async () => {
    const connection = cloudConnection("linked");
    const controller = { select: vi.fn(async () => {}) };

    await activateServerProfile(controller, cloudProfile, connection);

    expect(connection.connect).not.toHaveBeenCalled();
    expect(connection.openWorkspace).toHaveBeenCalledOnce();
    expect(connection.manage).not.toHaveBeenCalled();
    expect(controller.select).not.toHaveBeenCalled();
  });

  it("preserves Cloud host switching outside the Desktop connection flow", async () => {
    const controller = { select: vi.fn(async () => {}) };

    await activateServerProfile(controller, cloudProfile);

    expect(controller.select).toHaveBeenCalledWith("cloud:selftune");
  });

  it("does not open Team when connecting fails", async () => {
    const connection = cloudConnection(
      "unlinked",
      vi.fn(async () => {
        throw new Error("Connection cancelled");
      }),
    );
    const controller = { select: vi.fn(async () => {}) };
    await expect(activateServerProfile(controller, cloudProfile, connection)).rejects.toThrow(
      "Connection cancelled",
    );
    expect(connection.openWorkspace).not.toHaveBeenCalled();
    expect(connection.manage).not.toHaveBeenCalled();
    expect(controller.select).not.toHaveBeenCalled();
  });
});
