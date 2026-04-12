import {
  SkillsLibraryScreen,
  type SkillsLibraryHero,
  type SkillsLibraryPendingProposal,
} from "@selftune/dashboard-core/screens/skills";
import type { DerivedSkill } from "@selftune/ui/components";
import { deriveStatus, sortByPassRateAndChecks } from "@selftune/ui/lib";
import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import type { EvolutionEntry, OverviewResponse, SkillSummary } from "@/types";

/* ── Helpers ───────────────────────────────────────────────── */

function deriveSkills(skills: SkillSummary[]): DerivedSkill[] {
  return sortByPassRateAndChecks(
    skills.map((s) => ({
      name: s.skill_name,
      scope: s.skill_scope,
      platforms: [],
      passRate: s.total_checks > 0 ? s.pass_rate : null,
      checks: s.total_checks,
      status: deriveStatus(s.pass_rate, s.total_checks),
      uniqueSessions: s.unique_sessions,
      triggeredCount: s.triggered_count,
      lastSeen: s.last_seen,
    })),
  );
}

function aggregatePassRate(skills: SkillSummary[]): number | null {
  const graded = skills.filter((s) => s.total_checks >= 5);
  if (graded.length === 0) return null;
  const totalChecks = graded.reduce((sum, s) => sum + s.total_checks, 0);
  const totalPasses = graded.reduce((sum, s) => sum + Math.round(s.pass_rate * s.total_checks), 0);
  return totalChecks > 0 ? totalPasses / totalChecks : null;
}

function findMostActiveSkill(
  skills: SkillSummary[],
  evolution: EvolutionEntry[],
): { skill: SkillSummary; latestEvolution: EvolutionEntry | null } | null {
  const sorted = [...evolution]
    .filter((e) => e.skill_name)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  for (const evo of sorted) {
    const skill = skills.find((s) => s.skill_name === evo.skill_name);
    if (skill) return { skill, latestEvolution: evo };
  }

  if (skills.length > 0) {
    const top = [...skills].sort((a, b) => b.total_checks - a.total_checks)[0];
    return { skill: top, latestEvolution: sorted[0] ?? null };
  }
  return null;
}

/* ── Render-prop helpers for React Router links ────────────── */

function renderHeroActions(skillName: string) {
  const encoded = encodeURIComponent(skillName);
  return (
    <>
      <Link
        to={`/skills/${encoded}`}
        className="px-6 py-2 rounded-xl text-muted-foreground font-bold hover:bg-input transition-colors"
      >
        Configure
      </Link>
      <Link
        to={`/skills/${encoded}`}
        className="px-8 py-2 bg-primary text-primary-foreground font-bold rounded-xl shadow-[0_4px_20px_rgba(79,242,255,0.2)] hover:shadow-[0_4px_25px_rgba(79,242,255,0.4)] transition-all"
      >
        View Report
      </Link>
    </>
  );
}

function renderCardActions(skillName: string) {
  const encoded = encodeURIComponent(skillName);
  return (
    <>
      <Link
        to={`/skills/${encoded}`}
        className="flex-1 py-2 text-xs font-bold text-muted-foreground bg-muted rounded-lg text-center hover:bg-input transition-colors"
      >
        Configure
      </Link>
      <Link
        to={`/skills/${encoded}`}
        className="flex-1 py-2 text-xs font-bold text-muted-foreground bg-secondary rounded-lg text-center hover:bg-input hover:text-foreground transition-all"
      >
        View Report
      </Link>
    </>
  );
}

/* ── Main Component ────────────────────────────────────────── */

export function SkillsLibrary({
  overviewQuery,
}: {
  overviewQuery: UseQueryResult<OverviewResponse>;
}) {
  const { data, isLoading, isError, error, refetch } = overviewQuery;

  const allSkills = useMemo(() => (data ? deriveSkills(data.skills) : []), [data]);

  const heroData = useMemo(() => {
    if (!data) return null;
    return findMostActiveSkill(data.skills, data.overview.evolution);
  }, [data]);

  const heroSkill = useMemo<SkillsLibraryHero | null>(() => {
    if (!heroData) return null;
    return {
      skillName: heroData.skill.skill_name,
      skillScope: heroData.skill.skill_scope,
      passRate: heroData.skill.total_checks > 0 ? heroData.skill.pass_rate : null,
      totalChecks: heroData.skill.total_checks,
      uniqueSessions: heroData.skill.unique_sessions,
      status: deriveStatus(heroData.skill.pass_rate, heroData.skill.total_checks),
      latestEvolutionTimestamp: heroData.latestEvolution?.timestamp ?? null,
    };
  }, [heroData]);

  const pendingProposals = useMemo<SkillsLibraryPendingProposal[]>(() => {
    if (!data) return [];
    return data.overview.pending_proposals.map((proposal) => ({
      id: proposal.proposal_id,
      skillName: proposal.skill_name ?? null,
      action: proposal.action,
    }));
  }, [data]);

  return (
    <SkillsLibraryScreen
      skills={allSkills}
      heroSkill={heroSkill}
      aggregatePassRate={data ? aggregatePassRate(data.skills) : null}
      gradedCount={data ? data.skills.filter((skill) => skill.total_checks >= 5).length : 0}
      pendingProposals={pendingProposals}
      isLoading={isLoading}
      error={
        isError ? (error instanceof Error ? error.message : "Failed to load skills library.") : null
      }
      onRetry={() => {
        void refetch();
      }}
      renderHeroActions={renderHeroActions}
      renderCardActions={renderCardActions}
    />
  );
}
