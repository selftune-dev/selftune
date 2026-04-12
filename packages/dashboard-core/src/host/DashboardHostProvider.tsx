import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { DashboardHostAdapter } from "./adapter";
import type { Capabilities, DashboardFeatureKey } from "./capabilities";
import { canUseFeature } from "./capabilities";

export interface DashboardHostContextValue {
  adapter: DashboardHostAdapter;
  capabilities: Capabilities;
}

const DashboardHostContext = createContext<DashboardHostContextValue | null>(null);

interface DashboardHostProviderProps {
  adapter: DashboardHostAdapter;
  capabilities: Capabilities;
  children: ReactNode;
}

export function DashboardHostProvider({
  adapter,
  capabilities,
  children,
}: DashboardHostProviderProps) {
  const value = useMemo(
    () => ({
      adapter,
      capabilities,
    }),
    [adapter, capabilities],
  );

  return <DashboardHostContext.Provider value={value}>{children}</DashboardHostContext.Provider>;
}

export function useDashboardHost(): DashboardHostContextValue {
  const context = useContext(DashboardHostContext);
  if (!context) {
    throw new Error("useDashboardHost must be used within a DashboardHostProvider");
  }
  return context;
}

export function useOptionalDashboardHost(): DashboardHostContextValue | null {
  return useContext(DashboardHostContext);
}

export function useDashboardHostAdapter(): DashboardHostAdapter {
  return useDashboardHost().adapter;
}

export function useOptionalDashboardHostAdapter(): DashboardHostAdapter | null {
  return useOptionalDashboardHost()?.adapter ?? null;
}

export function useCapabilities(): Capabilities {
  return useDashboardHost().capabilities;
}

export function useFeatureEnabled(feature: DashboardFeatureKey): boolean {
  return canUseFeature(useCapabilities(), feature);
}
