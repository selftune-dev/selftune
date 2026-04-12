import { Button } from "@selftune/ui/primitives";
import type { UseQueryResult } from "@tanstack/react-query";
import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";
import { Link } from "react-router-dom";
import {
  OverviewCompositionSurface,
  type OverviewComparisonRow,
} from "@selftune/dashboard-core/screens/overview";

import { Skeleton } from "@/components/ui/skeleton";
import { useOrchestrateRuns } from "@/hooks/useOrchestrateRuns";
import type { OverviewResponse, SkillHealthStatus } from "@/types";

// ---------------------------------------------------------------------------
// Overview (main export)
// ---------------------------------------------------------------------------

export function Overview({
  search: _search,
  statusFilter: _statusFilter,
  onStatusFilterChange: _onStatusFilterChange,
  overviewQuery,
}: {
  search: string;
  statusFilter: SkillHealthStatus | "ALL";
  onStatusFilterChange: (v: SkillHealthStatus | "ALL") => void;
  overviewQuery: UseQueryResult<OverviewResponse>;
}) {
  const { data, isPending, isError, error, refetch } = overviewQuery;
  const orchestrateQuery = useOrchestrateRuns();

  if (isPending) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-6 py-6 px-4 lg:px-6">
        <Skeleton className="h-[340px] rounded-xl" />
        <div className="grid grid-cols-12 gap-6">
          <Skeleton className="col-span-12 @4xl/main:col-span-8 h-64 rounded-xl" />
          <Skeleton className="col-span-12 @4xl/main:col-span-4 h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
        <AlertCircleIcon className="size-10 text-destructive" />
        <p className="text-sm font-medium text-destructive">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCwIcon className="mr-2 size-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16">
        <p className="text-sm text-muted-foreground">
          No telemetry data found. Run some sessions first.
        </p>
      </div>
    );
  }

  const { skills, autonomy_status, attention_queue, trust_watchlist, recent_decisions, overview } =
    data;

  // Orchestrate summary
  const orchRuns = orchestrateQuery.data?.runs ?? [];
  const latestRun = orchRuns[0];
  const totalDeployed = orchRuns.reduce((s, r) => s + r.deployed, 0);
  const totalEvolved = orchRuns.reduce((s, r) => s + r.evolved, 0);
  const totalWatched = orchRuns.reduce((s, r) => s + r.watched, 0);
  const latestEvolutionBySkill = new Map<string, (typeof overview.evolution)[number]>();
  for (const entry of overview.evolution) {
    if (!entry.skill_name || latestEvolutionBySkill.has(entry.skill_name)) continue;
    latestEvolutionBySkill.set(entry.skill_name, entry);
  }

  const comparisonRows: OverviewComparisonRow[] = skills.map((skill) => {
    const trust = trust_watchlist.find((entry) => entry.skill_name === skill.skill_name);
    return {
      skillName: skill.skill_name,
      subtext: `${skill.skill_scope ?? "Unscoped"} · ${skill.total_checks} checks`,
      triggerRate: trust?.pass_rate ?? skill.pass_rate,
      routingConfidence: skill.routing_confidence,
      confidenceCoverage: skill.confidence_coverage,
      sessions: skill.unique_sessions,
      lastEvolution: latestEvolutionBySkill.get(skill.skill_name) ?? null,
      bucket: trust?.bucket ?? "uncertain",
      sortTimestamp: skill.last_seen ?? null,
    };
  });

  return (
    <OverviewCompositionSurface
      autonomyStatus={autonomy_status}
      lastRun={latestRun?.timestamp ?? null}
      trustWatchlist={trust_watchlist}
      attentionItems={attention_queue}
      autonomousDecisions={recent_decisions}
      renderSkillLink={(skillName) => (
        <Link
          to={`/skills/${encodeURIComponent(skillName)}`}
          className="text-sm font-medium hover:underline"
        >
          {skillName}
        </Link>
      )}
      onboarding={{
        skillCount: skills.length,
      }}
      heroActions={
        <div className="flex items-center gap-3">
          {autonomy_status.attention_required > 0 ? (
            <Button size="sm" nativeButton={false} render={<a href="#supervision-feed" />}>
              Review Attention Queue
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">No action needed</span>
          )}
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link to="?action=evolve" />}
          >
            Run Evolution
          </Button>
        </div>
      }
      trustRailFooter={
        <Link to="/skills" className="text-xs font-medium text-primary hover:underline">
          View All Skills
        </Link>
      }
      comparison={{
        rows: comparisonRows,
        libraryAction: (
          <Link to="/skills" className="text-xs font-medium text-primary hover:underline">
            View library
          </Link>
        ),
        watchlist: {
          initialSkills: data.watched_skills,
        },
      }}
      runSummary={{
        lastRun: latestRun?.timestamp ?? null,
        deployed: totalDeployed,
        evolved: totalEvolved,
        watched: totalWatched,
        runCount: orchRuns.length,
        historyAction: (
          <Link to="/analytics" className="text-primary hover:underline">
            View full history
          </Link>
        ),
      }}
    />
  );
}
