import { EvolutionTimeline } from "@selftune/ui/components";
import { EvidenceViewer } from "@selftune/ui/components";
import { InfoTip } from "@selftune/ui/components";
import { formatRate, timeAgo } from "@selftune/ui/lib";
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@selftune/ui/primitives";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  ActivityIcon,
  EyeIcon,
  RefreshCwIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  ShieldIcon,
  ShieldQuestionIcon,
  TargetIcon,
  SearchIcon,
  SparklesIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  BarChart3Icon,
  DatabaseIcon,
  GitBranchIcon,
  FilterIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";
import { useSkillReport } from "@/hooks/useSkillReport";
import type { ExampleRow, TrustState } from "@/types";

/* ─── Trust badge config ──────────────────────────────── */

const TRUST_BADGE: Record<
  TrustState,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ReactNode;
  }
> = {
  low_sample: {
    label: "Low Sample",
    variant: "secondary",
    icon: <ShieldQuestionIcon className="size-3" />,
  },
  observed: {
    label: "Observed",
    variant: "outline",
    icon: <EyeIcon className="size-3" />,
  },
  watch: {
    label: "Watch",
    variant: "secondary",
    icon: <ShieldAlertIcon className="size-3" />,
  },
  validated: {
    label: "Validated",
    variant: "default",
    icon: <ShieldCheckIcon className="size-3" />,
  },
  deployed: {
    label: "Deployed",
    variant: "default",
    icon: <ShieldCheckIcon className="size-3" />,
  },
  rolled_back: {
    label: "Rolled Back",
    variant: "destructive",
    icon: <ShieldIcon className="size-3" />,
  },
};

/* ─── Rate bar component ──────────────────────────────── */

function RateBar({
  label,
  value,
  warn,
}: {
  label: string;
  value: number | null | undefined;
  warn?: boolean;
}) {
  const pct = value != null ? Math.round(value * 100) : null;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground w-40 shrink-0 font-headline">
        {label}
      </span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        {pct != null && (
          <div
            className={`h-full rounded-full transition-all ${warn ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        )}
      </div>
      <span
        className={`text-xs font-mono tabular-nums w-10 text-right ${warn ? "text-destructive" : "text-muted-foreground"}`}
      >
        {pct != null ? `${pct}%` : "--"}
      </span>
    </div>
  );
}

/* ─── Example row renderer ────────────────────────────── */

function ExampleRowItem({ row }: { row: ExampleRow }) {
  const workspace = row.workspace_path ? row.workspace_path.split("/").slice(-2).join("/") : null;

  return (
    <TableRow className={!row.triggered ? "bg-destructive/5" : ""}>
      <TableCell
        className="max-w-[400px] truncate text-sm py-2"
        title={row.query_text || undefined}
      >
        {row.query_text || (
          <span className="text-muted-foreground/40 italic">No prompt recorded</span>
        )}
      </TableCell>
      <TableCell className="py-2">
        {row.triggered ? (
          <Badge
            variant="outline"
            className="text-[10px] font-normal text-green-600 border-green-600/30"
          >
            triggered
          </Badge>
        ) : (
          <Badge variant="destructive" className="text-[10px] font-normal">
            missed
          </Badge>
        )}
      </TableCell>
      <TableCell className="py-2 font-mono text-xs text-muted-foreground tabular-nums">
        {row.confidence != null ? `${Math.round(row.confidence * 100)}%` : "--"}
      </TableCell>
      <TableCell className="py-2">
        {row.invocation_mode ? (
          <Badge variant="secondary" className="text-[10px] font-normal">
            {row.invocation_mode}
          </Badge>
        ) : (
          <span className="text-[11px] text-muted-foreground">--</span>
        )}
      </TableCell>
      <TableCell className="py-2 text-[11px] text-muted-foreground">
        {row.prompt_kind ?? "--"}
      </TableCell>
      <TableCell className="py-2 text-[11px] text-muted-foreground">{row.source ?? "--"}</TableCell>
      <TableCell className="py-2 text-[11px] text-muted-foreground">
        {row.platform ?? "--"}
      </TableCell>
      <TableCell
        className="py-2 text-[11px] text-muted-foreground font-mono"
        title={row.workspace_path ?? undefined}
      >
        {workspace ?? "--"}
      </TableCell>
      <TableCell className="py-2">
        <Badge
          variant={
            row.query_origin === "inline_query"
              ? "outline"
              : row.query_origin === "matched_prompt"
                ? "secondary"
                : "destructive"
          }
          className="text-[10px] font-normal"
        >
          {row.query_origin}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

/* ─── Examples table wrapper ──────────────────────────── */

function ExamplesTable({ rows, emptyMessage }: { rows: ExampleRow[]; emptyMessage: string }) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent bg-muted/40">
            <TableHead className="text-[11px] h-8">Prompt</TableHead>
            <TableHead className="text-[11px] h-8 w-[80px]">Status</TableHead>
            <TableHead className="text-[11px] h-8 w-[70px]">Confidence</TableHead>
            <TableHead className="text-[11px] h-8 w-[80px]">Mode</TableHead>
            <TableHead className="text-[11px] h-8 w-[80px]">Kind</TableHead>
            <TableHead className="text-[11px] h-8 w-[70px]">Source</TableHead>
            <TableHead className="text-[11px] h-8 w-[70px]">Platform</TableHead>
            <TableHead className="text-[11px] h-8 w-[100px]">Workspace</TableHead>
            <TableHead className="text-[11px] h-8 w-[100px]">Origin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <ExampleRowItem key={`${row.session_id}-${i}`} row={row} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ─── Session group (kept from V1) ────────────────────── */

function SessionGroup({
  sessionId,
  meta,
  invocations,
  defaultExpanded,
}: {
  sessionId: string;
  meta?:
    | { started_at?: string | null; model?: string | null; workspace_path?: string | null }
    | undefined;
  invocations: Array<{
    timestamp: string | null;
    session_id: string | null;
    triggered: boolean;
    query: string;
    invocation_mode: string | null;
    confidence: number | null;
    tool_name: string | null;
    agent_type: string | null;
  }>;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const ts = meta?.started_at ?? invocations[0]?.timestamp;
  const modeBreakdown = invocations.reduce(
    (acc, inv) => {
      const mode = inv.invocation_mode ?? "unknown";
      acc[mode] = (acc[mode] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden transition-colors">
      {/* Session header -- always visible */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 active:bg-muted/60 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRightIcon
          className={`size-3.5 text-muted-foreground shrink-0 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
        />
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {invocations.length} invocation{invocations.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-muted-foreground">{ts ? timeAgo(ts) : ""}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {meta?.model && (
              <Badge variant="secondary" className="text-[10px] font-normal">
                {meta.model}
              </Badge>
            )}
            {meta?.workspace_path && (
              <span
                className="text-[11px] text-muted-foreground font-mono"
                title={meta.workspace_path}
              >
                {meta.workspace_path.split("/").slice(-2).join("/")}
              </span>
            )}
          </div>
        </div>
        {/* Compact mode summary when collapsed */}
        {!expanded && (
          <div className="flex items-center gap-1 shrink-0">
            {Object.entries(modeBreakdown).map(([mode, count]) => (
              <Badge key={mode} variant="outline" className="text-[10px] font-normal gap-1">
                {mode} <span className="text-muted-foreground">{count}</span>
              </Badge>
            ))}
          </div>
        )}
        <span className="text-[10px] text-muted-foreground/40 font-mono shrink-0">
          {sessionId.substring(0, 8)}
        </span>
      </button>

      {/* Invocation table -- expanded */}
      {expanded && (
        <div className="border-t border-border/40 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/40">
                <TableHead className="text-[11px] h-8">
                  Prompt <InfoTip text="The user prompt that led to this skill being invoked" />
                </TableHead>
                <TableHead className="text-[11px] h-8 w-[90px]">
                  Mode{" "}
                  <InfoTip text="explicit = user typed /skillname; implicit = user mentioned skill by name; inferred = agent chose skill autonomously" />
                </TableHead>
                <TableHead className="text-[11px] h-8 w-[70px]">
                  Confidence{" "}
                  <InfoTip text="Model's confidence score (0-100%) when routing this prompt to the skill" />
                </TableHead>
                <TableHead className="text-[11px] h-8 w-[90px]">
                  Agent{" "}
                  <InfoTip text="Which agent invoked the skill -- main agent or a subagent type" />
                </TableHead>
                <TableHead className="text-[11px] h-8 w-[70px] text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invocations.map((inv, i) => (
                <TableRow key={i} className={!inv.triggered ? "bg-destructive/5" : ""}>
                  <TableCell
                    className="max-w-[500px] truncate text-sm py-2"
                    title={inv.query || undefined}
                  >
                    {inv.query || (
                      <span className="text-muted-foreground/40 italic">No prompt recorded</span>
                    )}
                    {!inv.triggered && (
                      <Badge variant="destructive" className="text-[10px] font-normal ml-2">
                        missed
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    {inv.invocation_mode ? (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {inv.invocation_mode}
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 font-mono text-xs text-muted-foreground tabular-nums">
                    {inv.confidence !== null ? `${Math.round(inv.confidence * 100)}%` : "--"}
                  </TableCell>
                  <TableCell className="py-2">
                    {inv.agent_type ? (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {inv.agent_type}
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 font-mono text-[11px] text-muted-foreground text-right whitespace-nowrap">
                    {inv.timestamp ? timeAgo(inv.timestamp) : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ─── Invocation filter type ──────────────────────────── */

type InvocationFilter = "all" | "misses" | "low_confidence" | "system_meta";

/* ─── Next best action logic ──────────────────────────── */

function deriveNextAction(
  trustState: TrustState,
  missRate: number | null | undefined,
  systemLikeRate: number | null | undefined,
  hasPendingProposals: boolean,
  _hasEvolution: boolean,
): {
  icon: React.ReactNode;
  text: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  if (trustState === "low_sample") {
    return {
      icon: <EyeIcon className="size-5" />,
      text: "Keep observing. This skill needs more sessions before trust can be assessed.",
      variant: "secondary",
    };
  }
  if (trustState === "rolled_back") {
    return {
      icon: <AlertTriangleIcon className="size-5 text-destructive" />,
      text: "Inspect rollback evidence before re-deploying.",
      variant: "destructive",
    };
  }
  if (trustState === "watch" && (systemLikeRate ?? 0) > 0.05) {
    return {
      icon: <AlertTriangleIcon className="size-5 text-amber-500" />,
      text: "Clean source-truth data or routing data before trusting this report.",
      variant: "secondary",
    };
  }
  if (trustState === "watch" && (missRate ?? 0) > 0) {
    return {
      icon: <SearchIcon className="size-5 text-amber-500" />,
      text: "Generate evals to investigate missed triggers.",
      variant: "secondary",
    };
  }
  if (hasPendingProposals) {
    return {
      icon: <GitBranchIcon className="size-5 text-primary" />,
      text: "Review pending proposal.",
      variant: "default",
    };
  }
  if (trustState === "validated") {
    return {
      icon: <ArrowRightIcon className="size-5 text-primary" />,
      text: "Deploy the validated candidate.",
      variant: "default",
    };
  }
  if (trustState === "observed" || trustState === "deployed") {
    return {
      icon: <CheckCircleIcon className="size-5 text-green-500" />,
      text: "No action needed. Skill is healthy and being monitored.",
      variant: "outline",
    };
  }
  return {
    icon: <EyeIcon className="size-5" />,
    text: "Continue monitoring this skill.",
    variant: "outline",
  };
}

/* ─── Breakdown table ─────────────────────────────────── */

function BreakdownTable({
  title,
  data,
}: {
  title: string;
  data: Array<{ source?: string; kind?: string; count: number }> | null | undefined;
}) {
  if (!data || data.length === 0) return null;
  const entries = data
    .map((d) => [d.source ?? d.kind ?? "(unknown)", d.count] as [string, number])
    .sort(([, a], [, b]) => b - a);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-headline mb-2">
        {title}
      </h4>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-[11px] h-7">Value</TableHead>
            <TableHead className="text-[11px] h-7 w-[80px] text-right">Count</TableHead>
            <TableHead className="text-[11px] h-7 w-[80px] text-right">Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(([key, count]) => (
            <TableRow key={key}>
              <TableCell className="py-1.5 text-sm font-mono">{key || "(empty)"}</TableCell>
              <TableCell className="py-1.5 text-xs tabular-nums text-right text-muted-foreground">
                {count}
              </TableCell>
              <TableCell className="py-1.5 text-xs tabular-nums text-right text-muted-foreground">
                {total > 0 ? `${Math.round((count / total) * 100)}%` : "--"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SkillReport — trust-first skill report page
   ═══════════════════════════════════════════════════════════ */

export function SkillReport() {
  const { name } = useParams<{ name: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isPending, isError, error, refetch } = useSkillReport(name);

  // Invocation filter state
  const [invocationFilter, setInvocationFilter] = useState<InvocationFilter>("all");

  // Derive proposal state from data (safe to compute even when data is null)
  const evolution = data?.evolution ?? [];
  const proposalIds = new Set(evolution.map((entry) => entry.proposal_id));
  const requestedProposal = searchParams.get("proposal");
  const activeProposal =
    requestedProposal && proposalIds.has(requestedProposal)
      ? requestedProposal
      : evolution.length > 0
        ? evolution[0].proposal_id
        : null;

  // All hooks must be called unconditionally -- before any early returns
  useEffect(() => {
    const current = searchParams.get("proposal");
    if (activeProposal && current !== activeProposal) {
      const next = new URLSearchParams(searchParams);
      next.set("proposal", activeProposal);
      setSearchParams(next, { replace: true });
      return;
    }
    if (!activeProposal && current) {
      const next = new URLSearchParams(searchParams);
      next.delete("proposal");
      setSearchParams(next, { replace: true });
    }
  }, [activeProposal, searchParams, setSearchParams]);

  const handleSelectProposal = (proposalId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("proposal", proposalId);
    setSearchParams(next, { replace: true });
  };

  // Trust fields from extended SkillReportResponse
  const trust = data?.trust;
  const coverage = data?.coverage;
  const evidenceQuality = data?.evidence_quality;
  const routingQuality = data?.routing_quality;
  const evolutionState = data?.evolution_state;
  const dataHygiene = data?.data_hygiene;
  const examples = data?.examples;

  // Filtered invocations for the invocations tab
  const mergedInvocations = useMemo(() => {
    const invs = (data?.canonical_invocations ?? []).map((ci) => ({
      timestamp: ci.timestamp || ci.occurred_at || null,
      session_id: ci.session_id,
      triggered: ci.triggered,
      query: ci.query ?? "",
      source: ci.source ?? "",
      invocation_mode: ci.invocation_mode ?? null,
      confidence: ci.confidence ?? null,
      tool_name: ci.tool_name ?? null,
      agent_type: ci.agent_type ?? null,
    }));
    invs.sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
    return invs;
  }, [data?.canonical_invocations]);

  const filteredInvocations = useMemo(() => {
    switch (invocationFilter) {
      case "misses":
        return mergedInvocations.filter((i) => !i.triggered);
      case "low_confidence":
        return mergedInvocations.filter((i) => i.confidence !== null && i.confidence < 0.5);
      case "system_meta":
        return mergedInvocations.filter(
          (i) => i.invocation_mode === "system" || i.invocation_mode === "meta",
        );
      default:
        return mergedInvocations;
    }
  }, [mergedInvocations, invocationFilter]);

  const sessionMetaMap = useMemo(
    () => new Map((data?.session_metadata ?? []).map((s) => [s.session_id, s])),
    [data?.session_metadata],
  );

  const groupedSessions = useMemo(() => {
    const sessionMap = new Map<string, typeof filteredInvocations>();
    for (const inv of filteredInvocations) {
      const sid = inv.session_id ?? "unknown";
      const arr = sessionMap.get(sid);
      if (arr) arr.push(inv);
      else sessionMap.set(sid, [inv]);
    }
    return [...sessionMap.entries()].sort(([, a], [, b]) =>
      (b[0]?.timestamp ?? "").localeCompare(a[0]?.timestamp ?? ""),
    );
  }, [filteredInvocations]);

  /* ─── Early returns ─────────────────────────────────── */

  if (!name) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <p className="text-sm text-destructive">No skill name provided</p>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
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
      <div className="flex flex-1 items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">No data yet</p>
      </div>
    );
  }

  const isNotFound =
    (coverage?.checks ?? data.usage.total_checks) === 0 &&
    data.evidence.length === 0 &&
    data.evolution.length === 0 &&
    (data.canonical_invocations?.length ?? 0) === 0;

  if (isNotFound) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
        <p className="text-sm text-muted-foreground">No data found for skill "{name}".</p>
        <Button variant="outline" size="sm" render={<Link to="/" />}>
          <ArrowLeftIcon className="mr-2 size-3.5" />
          Back to Overview
        </Button>
      </div>
    );
  }

  const trustState = trust?.state ?? "low_sample";
  const trustBadge = TRUST_BADGE[trustState];
  const hasEvolutionData = (evolutionState?.evolution_rows ?? evolution.length) > 0;

  const defaultTab = hasEvolutionData ? "evidence" : "invocations";

  const nextAction = deriveNextAction(
    trustState,
    routingQuality?.miss_rate,
    evidenceQuality?.system_like_rate,
    evolutionState?.has_pending_proposals ?? data.pending_proposals.length > 0,
    hasEvolutionData,
  );

  return (
    <Tabs defaultValue={defaultTab}>
      <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:px-6 lg:pb-6 lg:pt-0">
        {/* ─── 1. Trust Header (sticky) ───────────────── */}
        <div className="sticky top-0 z-30 bg-background py-3 border-b border-border/50 space-y-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" render={<Link to="/" />} className="shrink-0">
              <ArrowLeftIcon className="size-3.5" />
            </Button>
            <h1 className="text-base font-semibold tracking-tight lg:text-lg font-headline shrink-0">
              {data.skill_name}
            </h1>
            <Badge variant={trustBadge.variant} className="gap-1 shrink-0 text-[10px]">
              {trustBadge.icon}
              {trustBadge.label}
            </Badge>
            {trust?.summary && (
              <span className="text-sm text-muted-foreground truncate hidden @xl/main:inline">
                {trust.summary}
              </span>
            )}
            <div className="ml-auto flex items-center gap-4 shrink-0">
              <div className="hidden @xl/main:flex items-center gap-3 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  <strong className="text-foreground">
                    {coverage?.checks ?? data.usage.total_checks}
                  </strong>{" "}
                  checks
                </span>
                <span className="text-border">|</span>
                <span className="tabular-nums">
                  <strong className="text-foreground">
                    {coverage?.sessions ?? data.sessions_with_skill}
                  </strong>{" "}
                  sessions
                </span>
                <span className="text-border">|</span>
                <span className="tabular-nums">
                  <strong className="text-foreground">{coverage?.workspaces ?? "--"}</strong>{" "}
                  workspaces
                </span>
              </div>
              {(coverage?.first_seen || coverage?.last_seen) && (
                <div className="hidden @3xl/main:flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                  {coverage.first_seen && (
                    <span title="First seen">{timeAgo(coverage.first_seen)}</span>
                  )}
                  {coverage.first_seen && coverage.last_seen && <span>-</span>}
                  {coverage.last_seen && (
                    <span title="Last seen">{timeAgo(coverage.last_seen)}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <TabsList variant="line">
            {hasEvolutionData && (
              <Tooltip>
                <TooltipTrigger render={<TabsTrigger value="evidence" />}>Evidence</TooltipTrigger>
                <TooltipContent>Change history and validation results</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger render={<TabsTrigger value="invocations" />}>
                Invocations
                <Badge variant="secondary" className="text-[10px] ml-1.5">
                  {mergedInvocations.length}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Recent skill triggers and their outcomes</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<TabsTrigger value="data-quality" />}>
                Data Quality
              </TooltipTrigger>
              <TooltipContent>Evidence quality metrics and data hygiene</TooltipContent>
            </Tooltip>
          </TabsList>
        </div>

        {/* ─── 2. Trust Summary Cards ─────────────────── */}
        <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          {/* Coverage */}
          <Card className="rounded-2xl bg-muted @container/card">
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <ActivityIcon className="size-3.5" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-headline">
                  Coverage
                </span>
              </CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {coverage?.checks ?? data.usage.total_checks}
              </CardTitle>
              <CardAction>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {coverage?.sessions ?? data.sessions_with_skill} sessions /{" "}
                  {coverage?.workspaces ?? "--"} dirs
                </span>
              </CardAction>
            </CardHeader>
          </Card>

          {/* Evidence Quality */}
          <Card className="rounded-2xl bg-muted @container/card">
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <SearchIcon className="size-3.5" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-headline">
                  Evidence Quality
                </span>
                <InfoTip text="How well prompts are linked to invocations. Higher prompt-link rate = more trustworthy data." />
              </CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {evidenceQuality?.prompt_link_rate != null
                  ? formatRate(evidenceQuality.prompt_link_rate)
                  : "--"}
              </CardTitle>
              <CardAction>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    inline:{" "}
                    {evidenceQuality?.inline_query_rate != null
                      ? formatRate(evidenceQuality.inline_query_rate)
                      : "--"}
                  </span>
                  {(evidenceQuality?.system_like_rate ?? 0) > 0.05 && (
                    <Badge variant="destructive" className="text-[9px]">
                      {formatRate(evidenceQuality?.system_like_rate ?? 0)} system-like
                    </Badge>
                  )}
                </div>
              </CardAction>
            </CardHeader>
          </Card>

          {/* Routing */}
          <Card className="rounded-2xl bg-muted @container/card">
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <TargetIcon className="size-3.5" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-headline">
                  Routing
                </span>
                <InfoTip text="Routing accuracy: average confidence when triggering, and miss rate" />
              </CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {routingQuality?.avg_confidence != null
                  ? formatRate(routingQuality.avg_confidence)
                  : "--"}
              </CardTitle>
              <CardAction>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    miss:{" "}
                    {routingQuality?.miss_rate != null
                      ? formatRate(routingQuality.miss_rate)
                      : "--"}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {routingQuality?.missed_triggers ?? "--"} missed
                  </span>
                </div>
              </CardAction>
            </CardHeader>
          </Card>

          {/* Evolution */}
          <Card className="rounded-2xl bg-muted @container/card">
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <SparklesIcon className="size-3.5" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-headline">
                  Evolution
                </span>
              </CardDescription>
              {hasEvolutionData ? (
                <>
                  <CardTitle className="text-sm font-medium">
                    {evolutionState?.latest_action ?? evolution[0]?.action ?? "--"}
                  </CardTitle>
                  <CardAction>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {evolutionState?.evidence_rows ?? data.evidence.length} evidence
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {evolutionState?.evolution_rows ?? evolution.length} evolution
                      </span>
                      {evolutionState?.latest_timestamp && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {timeAgo(evolutionState.latest_timestamp)}
                        </span>
                      )}
                    </div>
                  </CardAction>
                </>
              ) : (
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  No evolution yet
                </CardTitle>
              )}
            </CardHeader>
          </Card>
        </div>

        {/* ─── 4. Prompt Evidence Section (always visible) ─ */}
        {examples &&
          (examples.good.length > 0 || examples.missed.length > 0 || examples.noisy.length > 0) && (
            <Card className="rounded-2xl bg-muted">
              <CardHeader>
                <CardTitle className="font-headline text-sm">Prompt Evidence</CardTitle>
                <CardDescription>Sampled prompts categorized by quality</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="good">
                  <TabsList variant="line">
                    <TabsTrigger value="good">
                      Good Evidence
                      <Badge variant="outline" className="text-[10px] ml-1.5">
                        {examples.good.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="missed">
                      Missed Opportunities
                      <Badge
                        variant={examples.missed.length > 0 ? "destructive" : "outline"}
                        className="text-[10px] ml-1.5"
                      >
                        {examples.missed.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="noisy">
                      Probably Polluted
                      <Badge
                        variant={examples.noisy.length > 0 ? "destructive" : "outline"}
                        className="text-[10px] ml-1.5"
                      >
                        {examples.noisy.length}
                      </Badge>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="good" className="mt-4">
                    <ExamplesTable
                      rows={examples.good}
                      emptyMessage="No good evidence samples yet."
                    />
                  </TabsContent>
                  <TabsContent value="missed" className="mt-4">
                    <ExamplesTable
                      rows={examples.missed}
                      emptyMessage="No missed opportunities detected."
                    />
                  </TabsContent>
                  <TabsContent value="noisy" className="mt-4">
                    <ExamplesTable
                      rows={examples.noisy}
                      emptyMessage="No polluted samples detected."
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

        {/* ─── Main content: sidebar timeline + tabbed detail ─ */}
        <div className="flex gap-6">
          {/* Left sidebar: Evolution Timeline -- sticky */}
          {evolution.length > 0 && (
            <aside className="w-[220px] shrink-0 border-r pr-4 sticky top-28 self-start max-h-[calc(100svh-7rem)] overflow-y-auto themed-scroll">
              <EvolutionTimeline
                entries={evolution}
                selectedProposalId={activeProposal}
                onSelect={handleSelectProposal}
              />
            </aside>
          )}

          {/* Right content area */}
          <div className="flex-1 min-w-0">
            {/* ─── 3. Evidence Tab ─────────────────────── */}
            {hasEvolutionData && (
              <TabsContent value="evidence">
                {activeProposal ? (
                  <EvidenceViewer
                    proposalId={activeProposal}
                    evolution={evolution}
                    evidence={data.evidence}
                  />
                ) : (
                  <Card className="rounded-2xl">
                    <CardContent className="py-12">
                      <div className="flex flex-col items-center justify-center gap-3 text-center">
                        <EyeIcon className="size-8 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">
                          This skill is being observed but has no reviewable evolution evidence yet.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            )}

            {/* ─── 5. Invocations Tab ─────────────────── */}
            <TabsContent value="invocations">
              {mergedInvocations.length === 0 ? (
                <Card className="rounded-2xl">
                  <CardContent className="py-12">
                    <p className="text-sm text-muted-foreground text-center">
                      No invocation records yet.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {/* Filters */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FilterIcon className="size-3.5 text-muted-foreground" />
                      {(
                        [
                          ["all", "All"],
                          ["misses", "Misses"],
                          ["low_confidence", "Low confidence"],
                          ["system_meta", "System/meta"],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setInvocationFilter(key)}
                          className="inline-block"
                        >
                          <Badge
                            variant={invocationFilter === key ? "default" : "outline"}
                            className="text-[10px] cursor-pointer"
                          >
                            {label}
                          </Badge>
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {filteredInvocations.length} invocations across {groupedSessions.length}{" "}
                      sessions
                    </span>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-[9px] font-normal">
                        explicit
                      </Badge>{" "}
                      user typed /skill
                    </span>
                    <span className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-[9px] font-normal">
                        implicit
                      </Badge>{" "}
                      mentioned by name
                    </span>
                    <span className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-[9px] font-normal">
                        inferred
                      </Badge>{" "}
                      agent chose autonomously
                    </span>
                  </div>

                  {groupedSessions.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                      No invocations match this filter.
                    </div>
                  ) : (
                    groupedSessions.map(([sessionId, invocations], idx) => {
                      const meta = sessionMetaMap.get(sessionId);
                      return (
                        <SessionGroup
                          key={sessionId}
                          sessionId={sessionId}
                          meta={meta}
                          invocations={invocations}
                          defaultExpanded={idx < 3}
                        />
                      );
                    })
                  )}
                </div>
              )}
            </TabsContent>

            {/* ─── 6. Data Quality Tab ────────────────── */}
            <TabsContent value="data-quality">
              <div className="space-y-6">
                {/* Rate bars */}
                <Card className="rounded-2xl bg-muted">
                  <CardHeader>
                    <CardTitle className="font-headline text-sm flex items-center gap-2">
                      <BarChart3Icon className="size-4" />
                      Evidence Quality Rates
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <RateBar label="Prompt-linked" value={evidenceQuality?.prompt_link_rate} />
                    <RateBar label="Inline query" value={evidenceQuality?.inline_query_rate} />
                    <RateBar label="User prompt" value={evidenceQuality?.user_prompt_rate} />
                    <RateBar label="Meta prompt" value={evidenceQuality?.meta_prompt_rate} />
                    <RateBar label="No prompt" value={evidenceQuality?.no_prompt_rate} />
                    <RateBar
                      label="System-like"
                      value={evidenceQuality?.system_like_rate}
                      warn={(evidenceQuality?.system_like_rate ?? 0) > 0.05}
                    />
                    <div className="border-t border-border/40 pt-3 mt-3" />
                    <RateBar
                      label="Invocation mode"
                      value={evidenceQuality?.invocation_mode_coverage}
                    />
                    <RateBar label="Confidence" value={evidenceQuality?.confidence_coverage} />
                    <RateBar label="Source" value={evidenceQuality?.source_coverage} />
                    <RateBar label="Scope" value={evidenceQuality?.scope_coverage} />
                  </CardContent>
                </Card>

                {/* Data hygiene */}
                {dataHygiene && (
                  <Card className="rounded-2xl bg-muted">
                    <CardHeader>
                      <CardTitle className="font-headline text-sm flex items-center gap-2">
                        <DatabaseIcon className="size-4" />
                        Data Hygiene
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Naming variants */}
                      {dataHygiene.naming_variants && dataHygiene.naming_variants.length > 1 && (
                        <div>
                          <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-headline mb-2">
                            Naming Variants
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {dataHygiene.naming_variants.map((v) => (
                              <Badge key={v} variant="outline" className="text-[10px] font-mono">
                                {v}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Multiple naming variants may indicate inconsistent skill registration.
                          </p>
                        </div>
                      )}

                      <BreakdownTable
                        title="Source Breakdown"
                        data={dataHygiene.source_breakdown}
                      />
                      <BreakdownTable
                        title="Prompt Kind Breakdown"
                        data={dataHygiene.prompt_kind_breakdown}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </div>
        </div>

        {/* ─── 7. Next Best Action Panel ──────────────── */}
        <Card
          className={`rounded-2xl border-2 ${nextAction.variant === "destructive" ? "border-destructive/40" : nextAction.variant === "default" ? "border-primary/40" : "border-border"}`}
        >
          <CardContent className="flex items-center gap-4 py-5">
            <div className="shrink-0">{nextAction.icon}</div>
            <div className="flex-1">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-headline mb-1">
                Next Best Action
              </h3>
              <p className="text-sm font-medium">{nextAction.text}</p>
            </div>
            <Badge variant={nextAction.variant} className="shrink-0">
              {trustBadge.label}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </Tabs>
  );
}
