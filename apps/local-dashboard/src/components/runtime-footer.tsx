import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RuntimeBadge, type DashboardLinkRenderer } from "@selftune/dashboard-core/chrome";

import type { HealthResponse } from "@/types";

function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.workspace_root === "string" &&
    typeof record.git_sha === "string" &&
    typeof record.db_path === "string" &&
    typeof record.process_mode === "string" &&
    (record.watcher_mode === "wal" ||
      record.watcher_mode === "jsonl" ||
      record.watcher_mode === "none")
  );
}

function renderRouterLink({
  href,
  className,
  children,
  onClick,
}: Parameters<DashboardLinkRenderer>[0]) {
  return (
    <Link to={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

export function RuntimeFooter() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data: unknown) => {
        if (isHealthResponse(data)) {
          setHealth(data);
        }
      })
      .catch(() => {
        /* non-critical — footer simply stays hidden */
      });
  }, []);

  if (!health) return null;
  const legacyWatcherMode = health.watcher_mode === "jsonl";
  const disabledWatcherMode = health.watcher_mode === "none";
  const statusLabel = legacyWatcherMode
    ? "Legacy watcher"
    : disabledWatcherMode
      ? "Watcher disabled"
      : "Runtime healthy";
  const tone = legacyWatcherMode ? "warning" : disabledWatcherMode ? "critical" : "healthy";

  return (
    <RuntimeBadge
      href="/status"
      label={statusLabel}
      detail={health.process_mode}
      tone={tone}
      renderLink={renderRouterLink}
    />
  );
}
