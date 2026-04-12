import { useEffect, useState } from "react";

import type { HealthResponse } from "@/types";
import { detectStaleClient, type StaleClientMismatch } from "@/lib/stale-client";

const BUILD_INFO = {
  version: __SELFTUNE_PACKAGE_VERSION__,
  buildId: __SELFTUNE_SPA_BUILD_ID__,
};

const POLL_INTERVAL_MS = 30_000;

export function StaleClientBanner() {
  const [mismatch, setMismatch] = useState<StaleClientMismatch | null>(null);

  useEffect(() => {
    let isActive = true;

    async function checkHealth() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as HealthResponse;
        if (!isActive) return;
        setMismatch(detectStaleClient(payload, BUILD_INFO));
      } catch {
        // Ignore transient health-check failures; the banner should only appear
        // when the server explicitly reports a newer build.
      }
    }

    void checkHealth();
    const interval = window.setInterval(() => {
      void checkHealth();
    }, POLL_INTERVAL_MS);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, []);

  if (!mismatch) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 z-[90] max-w-sm rounded-xl border border-amber-500/40 bg-background/95 p-4 shadow-2xl backdrop-blur">
      <p className="text-sm font-semibold text-foreground">Dashboard update available</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The running dashboard is on v{mismatch.serverVersion}. Reload to use the newer UI.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Reload now
        </button>
        <span className="text-xs text-muted-foreground">Current build: {BUILD_INFO.buildId}</span>
      </div>
    </div>
  );
}
