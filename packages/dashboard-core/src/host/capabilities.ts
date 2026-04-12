export const FEATURE_KEYS = [
  "analytics",
  "registry",
  "signals",
  "proposals",
  "billing",
  "teamAdmin",
  "runtimeStatus",
] as const;

export const DISCOVERABLE_FEATURE_KEYS = ["registry", "signals", "proposals", "billing"] as const;

export type DashboardHostKind = "local" | "cloud";
export type DashboardPlan = "oss" | "pro" | "team";
export type DashboardFeatureKey = (typeof FEATURE_KEYS)[number];
export type DashboardDiscoverableFeatureKey = (typeof DISCOVERABLE_FEATURE_KEYS)[number];

export type DashboardFeatureFlags = Record<DashboardFeatureKey, boolean>;
export type DashboardDiscoverableFlags = Record<DashboardDiscoverableFeatureKey, boolean>;

export interface Capabilities {
  host: DashboardHostKind;
  plan: DashboardPlan;
  features: DashboardFeatureFlags;
  discoverable: DashboardDiscoverableFlags;
}

export function canUseFeature(capabilities: Capabilities, feature: DashboardFeatureKey): boolean {
  return capabilities.features[feature];
}

export function canDiscoverFeature(
  capabilities: Capabilities,
  feature: DashboardDiscoverableFeatureKey,
): boolean {
  return capabilities.discoverable[feature] || capabilities.features[feature];
}

export function withCapabilityOverrides(
  base: Capabilities,
  overrides: Partial<Capabilities>,
): Capabilities {
  return {
    host: overrides.host ?? base.host,
    plan: overrides.plan ?? base.plan,
    features: {
      ...base.features,
      ...overrides.features,
    },
    discoverable: {
      ...base.discoverable,
      ...overrides.discoverable,
    },
  };
}
