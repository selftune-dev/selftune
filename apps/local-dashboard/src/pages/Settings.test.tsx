// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { settingsFor } from "../test-fixtures/settings";
import { Settings } from "./Settings";

const clients: QueryClient[] = [];

function renderSettings(url: string, route = "/settings?section=remote-library") {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (input === "/api/v2/settings") return Response.json(settingsFor(url));
    if (
      [
        "/api/v2/settings/billing/status",
        "/api/v2/settings/remote-library/status",
        "/api/v2/settings/remote-library/shares",
        "/api/v2/settings/workspace/members",
        "/api/v2/settings/workspace/policies",
      ].includes(String(input))
    ) {
      return new Response("Service unavailable", { status: 503 });
    }
    throw new Error(`Unexpected request: ${input}`);
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <Settings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  vi.restoreAllMocks();
});

describe("Settings remote-library capabilities", () => {
  it("distinguishes enabled Cloud package backup from local operational data", async () => {
    const cloud = renderSettings("https://cloud.selftune.dev");
    await screen.findByText(
      "Skill packages back up to the destination you enable in Cloud. Prompts, sessions, and evaluations stay local.",
    );
    expect(screen.queryByRole("switch", { name: "Decision history backup" })).toBeNull();

    cloud.unmount();
    renderSettings("https://selftune.example.com");
    await screen.findByText("Raw transcripts are never synced.");
    expect(screen.getByRole("switch", { name: "Decision history backup" })).not.toBeNull();
  });

  it("does not claim a stored Cloud credential is connected when verification fails", async () => {
    renderSettings("https://cloud.selftune.dev");
    await screen.findByText(
      "Cloud could not verify this device. Reconnect your account and retry.",
    );
    expect(screen.queryByText("SelfTune Cloud account connected")).toBeNull();
    expect(screen.queryByText("Checking SelfTune Cloud integrity...")).toBeNull();
  });

  it("explains the paid sync requirement after verifying a free account", async () => {
    renderSettings("https://cloud.selftune.dev");
    await screen.findByText(
      "Cloud could not verify this device. Reconnect your account and retry.",
    );
    act(() =>
      clients.at(-1)?.setQueryData(["cloud-billing"], {
        plan: "free",
        subscriptionStatus: "none",
      }),
    );
    await screen.findByText(
      "Account connected. An active Pro or Team plan is required for inventory sync and sharing.",
    );
    expect(
      screen.getByText("Your device credential was verified by SelfTune Cloud."),
    ).not.toBeNull();
  });
  it("renders a newly available automation job before the draft synchronization effect runs", async () => {
    const url = "https://cloud.selftune.dev";
    renderSettings(url, "/settings?section=automation");
    await screen.findByText("Run local collection and improvement jobs in the background.");
    const settings = settingsFor(url);
    act(() =>
      clients.at(-1)?.setQueryData(["settings"], {
        ...settings,
        schedule: {
          ...settings.schedule,
          jobs: [
            {
              id: "selftune-sync",
              label: "Collect",
              description: "Import local sessions",
              command: "selftune sync",
              default_schedule: "*/30 * * * *",
              schedule: "*/15 * * * *",
              enabled: false,
              active: false,
            },
          ],
        },
      }),
    );
    expect(await screen.findByRole("switch", { name: "Enable Collect" })).not.toBeNull();
    expect(screen.getByRole("combobox", { name: "Collect frequency" })).not.toBeNull();
  });

  it("shows backup controls for Cloud and self-hosting, even when remote status is unavailable", async () => {
    const cloud = renderSettings("https://cloud.selftune.dev");

    await screen.findByRole("heading", {
      name: "Sync & Backup",
    });
    expect(screen.getByTitle("Export complete backup")).not.toBeNull();
    expect(screen.getByTitle("Restore into a new local directory")).not.toBeNull();

    cloud.unmount();
    renderSettings("https://selftune.example.com");

    expect(await screen.findByTitle("Export complete backup")).not.toBeNull();
    expect(screen.getByTitle("Restore into a new local directory")).not.toBeNull();
  });
});
