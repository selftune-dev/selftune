// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DesktopBillingStatus } from "@/types";

import { BillingSettingsPanel } from "./BillingSettingsPanel";

const plans = [
  {
    id: "pro" as const,
    name: "Pro",
    price: "$10",
    period: "/month",
    description: "For individuals",
    features: [],
    highlighted: false,
  },
  {
    id: "team" as const,
    name: "Team",
    price: "$12",
    period: "/month",
    description: "For teams",
    features: [],
    highlighted: true,
    seats: { minimum: 3, label: "per seat" },
  },
];

function status(overrides: Partial<DesktopBillingStatus> = {}): DesktopBillingStatus {
  return {
    plan: "free",
    subscriptionStatus: "none",
    currentPeriodEnd: null,
    trialEnd: null,
    seatCount: 1,
    hasStripeCustomer: false,
    canManageBilling: true,
    availablePlans: plans,
    ...overrides,
  };
}

function renderPanel(props: Partial<React.ComponentProps<typeof BillingSettingsPanel>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <BillingSettingsPanel
        active
        cloudConfigured
        connectPending={false}
        onConnect={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("BillingSettingsPanel", () => {
  it("shows prices before linking and carries the selected plan to Cloud sign-in", async () => {
    const openExternal = vi.fn();
    renderPanel({ cloudConfigured: false, openExternal });
    expect(screen.getByLabelText("$19/month")).not.toBeNull();
    expect(screen.getByLabelText("$49/month")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Choose Team" }));
    await waitFor(() =>
      expect(openExternal).toHaveBeenCalledWith("https://cloud.selftune.dev/?billing=team&seats=3"),
    );
  });

  it("does not offer a Stripe portal for internal Team access", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(status({ plan: "team", subscriptionStatus: "active" })),
    );
    renderPanel();
    await screen.findByText("Current plan: Team");
    expect(screen.queryByRole("button", { name: "Manage subscription" })).toBeNull();
  });
  it("offers Connect Cloud while Desktop is not linked", () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected request"));
    const onConnect = vi.fn();
    renderPanel({ cloudConfigured: false, onConnect });
    fireEvent.click(screen.getByRole("button", { name: "Connect Cloud" }));
    expect(onConnect).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses a user-facing Enterprise fallback when Cloud omits that plan", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json(status({ plan: "enterprise", availablePlans: [] })),
    );
    renderPanel();
    await screen.findByText("Current plan: Enterprise");
  });

  it("shows pricing, sends the selected Team seats, and opens the returned checkout URL", async () => {
    const openExternal = vi.fn();
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url === "/api/v2/settings/billing/status") return Response.json(status());
      if (url === "/api/v2/settings/billing/checkout")
        return Response.json({ url: "https://stripe.test/checkout" });
      throw new Error(`Unexpected request: ${url}`);
    });
    renderPanel({ openExternal });
    await screen.findByText("Current plan: Community");
    expect(screen.getByLabelText("$12/month")).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Team seats"), { target: { value: "7" } });
    const [pro, team] = screen.getAllByRole("button", { name: "Choose plan" });
    if (!pro || !team) throw new Error("Expected Pro and Team choices");
    fireEvent.click(team);
    await waitFor(() => expect(openExternal).toHaveBeenCalledWith("https://stripe.test/checkout"));
    expect(fetch).toHaveBeenCalledWith(
      "/api/v2/settings/billing/checkout",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ plan: "team", seats: 7 }) }),
    );
  });

  it("recovers after an offline response without asking to reconnect", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: "UNAVAILABLE", message: "Cloud offline" } },
          { status: 503 },
        ),
      )
      .mockImplementation(async () => Response.json(status()));
    renderPanel();
    expect((await screen.findByRole("alert")).textContent).toContain("Cloud offline");
    expect(screen.queryByRole("button", { name: "Connect Cloud" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await screen.findByText("Current plan: Community");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Cloud offline")).toBeNull();
  });

  it("opens the portal for an existing subscription instead of creating checkout", async () => {
    const openExternal = vi.fn();
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url === "/api/v2/settings/billing/status")
        return Response.json(
          status({ plan: "pro", subscriptionStatus: "active", hasStripeCustomer: true }),
        );
      if (url === "/api/v2/settings/billing/portal")
        return Response.json({ url: "https://stripe.test/portal" });
      throw new Error(`Unexpected request: ${url}`);
    });
    renderPanel({ openExternal });
    fireEvent.click(await screen.findByRole("button", { name: "Manage subscription" }));
    await waitFor(() => expect(openExternal).toHaveBeenCalledWith("https://stripe.test/portal"));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/v2/settings/billing/portal",
      expect.objectContaining({ method: "POST", body: "{}" }),
    );
  });

  it("does not let a non-owner start checkout", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => Response.json(status({ canManageBilling: false })));
    renderPanel();
    await screen.findByText("Only workspace owners can manage billing.");
    for (const button of screen.getAllByRole("button", { name: "Choose plan" })) {
      expect(button.hasAttribute("disabled")).toBe(true);
      fireEvent.click(button);
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
