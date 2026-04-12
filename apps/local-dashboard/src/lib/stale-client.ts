import type { HealthResponse } from "@/types";

export interface DashboardClientBuildInfo {
  version: string;
  buildId: string;
}

export interface StaleClientMismatch {
  serverVersion: string;
  serverBuildId: string;
}

export function detectStaleClient(
  health: Partial<HealthResponse>,
  client: DashboardClientBuildInfo,
): StaleClientMismatch | null {
  if (!health.ok || health.service !== "selftune-dashboard") {
    return null;
  }

  const serverVersion = health.version ?? "unknown";
  const serverBuildId = health.spa_build_id ?? serverVersion;
  const clientBuildId = client.buildId || client.version;

  if (serverVersion === client.version && serverBuildId === clientBuildId) {
    return null;
  }

  return {
    serverVersion,
    serverBuildId,
  };
}
