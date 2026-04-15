import { afterEach, describe, expect, it, vi } from "vitest";

import { buildLiveRunHref, navigateToLiveRun } from "@/lib/live-run-link";

describe("useSSE live run navigation helpers", () => {
  const originalWindow = globalThis.window;
  const originalPopStateEvent = globalThis.PopStateEvent;

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "PopStateEvent", {
      value: originalPopStateEvent,
      configurable: true,
      writable: true,
    });
  });

  it("builds a live run href with event, action, and skill params", () => {
    expect(
      buildLiveRunHref({
        event_id: "evt-123",
        action: "measure-baseline",
        skill_name: "research-assistant",
      }),
    ).toBe("/live-run?event=evt-123&action=measure-baseline&skill=research-assistant");
  });

  it("navigates the browser history to the live run route", () => {
    const pushState = vi.fn();
    const dispatchEvent = vi.fn();
    class FakePopStateEvent {
      type: string;

      constructor(type: string) {
        this.type = type;
      }
    }

    Object.defineProperty(globalThis, "window", {
      value: {
        history: { pushState },
        dispatchEvent,
      },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "PopStateEvent", {
      value: FakePopStateEvent,
      configurable: true,
      writable: true,
    });

    const href = navigateToLiveRun({
      event_id: "evt-456",
      action: "deploy-candidate",
      skill_name: "Taxes",
    });

    expect(href).toBe("/live-run?event=evt-456&action=deploy-candidate&skill=Taxes");
    expect(pushState).toHaveBeenCalledWith(
      {},
      "",
      "/live-run?event=evt-456&action=deploy-candidate&skill=Taxes",
    );
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.calls[0]?.[0]).toBeInstanceOf(FakePopStateEvent);
    expect(dispatchEvent.mock.calls[0]?.[0]).toMatchObject({ type: "popstate" });
  });
});
