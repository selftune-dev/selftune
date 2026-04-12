import { AnalyticsScreen } from "@selftune/dashboard-core/screens/analytics";
import type { AnalyticsResponse } from "@selftune/ui/components";
import { Button } from "@selftune/ui/primitives";
import { useQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";

/* ── Data fetching ──────────────────────────────────────── */

async function fetchAnalytics(): Promise<AnalyticsResponse> {
  const response = await fetch("/api/v2/analytics");
  if (!response.ok) {
    throw new Error(`Failed to load analytics (${response.status})`);
  }
  return (await response.json()) as AnalyticsResponse;
}

/* ── Main Page ──────────────────────────────────────────── */

export function PerformanceAnalytics() {
  const { data, isPending, isError, error, refetch } = useQuery<AnalyticsResponse>({
    queryKey: ["analytics"],
    queryFn: fetchAnalytics,
    refetchInterval: 30_000,
  });

  return (
    <AnalyticsScreen
      data={data ?? null}
      isLoading={isPending}
      error={isError ? (error instanceof Error ? error.message : "Failed to load analytics") : null}
      onRefresh={() => {
        void refetch();
      }}
      onRetry={() => {
        void refetch();
      }}
      headerActions={
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5 font-headline text-[10px] uppercase tracking-widest"
          disabled
          aria-disabled="true"
          title="Export is not available yet."
        >
          <DownloadIcon className="size-3" />
          Export
        </Button>
      }
      insightActions={
        <>
          <Button
            size="sm"
            className="font-headline text-[10px] uppercase tracking-widest"
            disabled
            aria-disabled="true"
            title="Dashboard-triggered evolution is not available yet."
          >
            Run Evolution
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-primary/20 font-headline text-[10px] uppercase tracking-widest text-primary hover:border-primary/40"
            disabled
            aria-disabled="true"
            title="Detailed analytics drill-down is not available yet."
          >
            View Details
          </Button>
        </>
      }
    />
  );
}
