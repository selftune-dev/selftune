import { timeAgo } from "@selftune/ui/lib";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@selftune/ui/primitives";
import * as Lucide from "lucide-react";
import { Link } from "react-router-dom";

import { formatActionLabel, useLiveActionFeed } from "@/lib/live-action-feed";
import { buildLiveRunHref } from "@/lib/live-run-link";

function statusBadge(status: "running" | "success" | "error") {
  if (status === "running") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Lucide.Loader2 className="size-3 animate-spin" />
        Live
      </Badge>
    );
  }
  if (status === "success") {
    return <Badge variant="default">Done</Badge>;
  }
  return <Badge variant="destructive">Failed</Badge>;
}

export function LiveActionFeed() {
  const entries = useLiveActionFeed();
  if (entries.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-40 hidden w-[360px] xl:block">
      <Card className="pointer-events-auto border-border/40 bg-background/95 shadow-2xl backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Lucide.Activity className="size-4" />
            Live lifecycle actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {entries.slice(0, 4).map((entry) => (
            <Link
              key={entry.id}
              to={buildLiveRunHref({
                event_id: entry.id,
                action: entry.action,
                skill_name: entry.skillName,
              })}
              className="block rounded-xl border border-border/20 bg-muted/20 px-3 py-2 transition-colors hover:border-primary/30 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {formatActionLabel(entry.action)}
                    {entry.skillName ? ` · ${entry.skillName}` : ""}
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-muted-foreground">
                    {timeAgo(new Date(entry.updatedAt).toISOString())}
                  </div>
                </div>
                {statusBadge(entry.status)}
              </div>
              {entry.output.length > 0 ? (
                <div className="mt-2 rounded-lg bg-background px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                  {entry.output.at(-1)}
                </div>
              ) : null}
              {entry.error && entry.status === "error" ? (
                <p className="mt-2 text-[11px] text-destructive line-clamp-2">{entry.error}</p>
              ) : null}
              <div className="mt-2 flex items-center justify-end gap-1 text-[11px] font-medium text-primary">
                <span>Live run</span>
                <Lucide.ArrowRight className="size-3" />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
