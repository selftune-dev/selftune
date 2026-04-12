import type { ReactNode } from "react";

import { timeAgo } from "@selftune/ui/lib";

export interface OverviewRunSummaryProps {
  lastRun: string | null;
  deployed: number;
  evolved: number;
  watched: number;
  runCount: number;
  historyAction?: ReactNode;
}

export function OverviewRunSummary({
  lastRun,
  deployed,
  evolved,
  watched,
  runCount,
  historyAction,
}: OverviewRunSummaryProps) {
  if (runCount === 0) return null;

  return (
    <div className="col-span-12 flex items-center gap-6 rounded-xl border border-border/10 bg-card/50 px-5 py-3 text-xs text-muted-foreground">
      <span className="font-headline text-[10px] uppercase tracking-[0.2em]">Last Cycle</span>
      <span>{lastRun ? timeAgo(lastRun) : "Never"}</span>
      <span className="text-muted-foreground/30">|</span>
      <span>{deployed} deployed</span>
      <span>{evolved} evolved</span>
      <span>{watched} watched</span>
      {historyAction ? (
        <>
          <span className="text-muted-foreground/30">|</span>
          <span className="ml-auto">{historyAction}</span>
        </>
      ) : null}
    </div>
  );
}
