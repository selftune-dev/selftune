import type { ReactNode } from "react";

interface FeatureGateProps {
  enabled: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

export function FeatureGate({ enabled, fallback = null, children }: FeatureGateProps) {
  return enabled ? <>{children}</> : <>{fallback}</>;
}
