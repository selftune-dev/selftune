import type { DashboardHostAdapter, Capabilities } from "@selftune/dashboard-core/host";
import type {
  AnalyticsModel,
  OverviewModel,
  RuntimeHealthModel,
  SkillsModel,
} from "@selftune/dashboard-core/models";
import { fetchAnalytics, fetchOverview } from "./api";
import type { AnalyticsResponse, HealthResponse, OverviewResponse } from "./types";

export const LOCAL_CAPABILITIES: Capabilities = {
  host: "local",
  plan: "oss",
  features: {
    analytics: true,
    registry: false,
    signals: false,
    proposals: false,
    billing: false,
    teamAdmin: false,
    runtimeStatus: true,
  },
  discoverable: {
    registry: true,
    signals: true,
    proposals: true,
    billing: false,
  },
};

function mapOverviewModel(data: OverviewResponse): OverviewModel {
  return {
    version: data.version,
    summary: {
      totalSkills: data.skills.length,
      avgPassRate30d: data.skills.length
        ? data.skills.reduce((sum, skill) => sum + skill.pass_rate, 0) / data.skills.length
        : null,
      unmatchedCount30d: data.overview.unmatched_queries.length,
      sessionsCount30d: data.overview.counts.sessions,
      pendingCount: data.overview.pending_proposals.length,
      evidenceCount: data.overview.counts.evidence,
    },
    autonomy: {
      level: data.autonomy_status.level,
      summary: data.autonomy_status.summary,
      attentionRequired: data.autonomy_status.attention_required,
      skillsObserved: data.autonomy_status.skills_observed,
      pendingReviews: data.autonomy_status.pending_reviews,
      lastRunAt: data.autonomy_status.last_run,
    },
    skillCards: data.skills.map((skill) => ({
      name: skill.skill_name,
      scope: skill.skill_scope,
      platforms: skill.skill_scope ? [skill.skill_scope] : [],
      passRate: skill.pass_rate,
      checks: skill.total_checks,
      status:
        skill.pass_rate >= 0.8
          ? "HEALTHY"
          : skill.pass_rate >= 0.6
            ? "WARNING"
            : skill.total_checks > 0
              ? "CRITICAL"
              : "UNKNOWN",
      hasEvidence: skill.has_evidence,
      uniqueSessions: skill.unique_sessions,
      lastSeen: skill.last_seen,
    })),
    watchlist: data.trust_watchlist.map((entry) => ({
      skillName: entry.skill_name,
      bucket: entry.bucket,
      lastSeen: entry.last_seen,
      passRate: entry.pass_rate,
      checks: entry.checks,
    })),
    attention: data.attention_queue.map((item) => ({
      skillName: item.skill_name,
      severity: item.severity,
      title: item.category.replace(/_/g, " "),
      body: item.reason,
    })),
    decisions: data.recent_decisions.map((item) => ({
      skillName: item.skill_name,
      kind: item.kind,
      timestamp: item.timestamp,
      summary: item.summary,
    })),
    activity: data.overview.recent_activity.map((item) => ({
      id: `${item.session_id}:${item.timestamp}`,
      type: item.triggered ? "evolution" : "unmatched",
      skillName: item.skill_name,
      timestamp: item.timestamp,
      title: item.skill_name,
      summary: item.query,
    })),
    jobs: [],
    signals: null,
  };
}

function mapSkillsModel(data: OverviewResponse): SkillsModel {
  return {
    items: data.skills.map((skill) => ({
      name: skill.skill_name,
      platforms: skill.skill_scope ? [skill.skill_scope] : [],
      status:
        skill.pass_rate >= 0.8
          ? "HEALTHY"
          : skill.pass_rate >= 0.6
            ? "WARNING"
            : skill.total_checks > 0
              ? "CRITICAL"
              : "UNKNOWN",
      passRate: skill.pass_rate,
      totalChecks: skill.total_checks,
      uniqueSessions: skill.unique_sessions,
      evidenceCount: skill.has_evidence ? 1 : 0,
      lastSeen: skill.last_seen,
    })),
  };
}

function mapAnalyticsModel(data: AnalyticsResponse): AnalyticsModel {
  return {
    summary: {
      activeSkills: data.summary.active_skills,
      totalChecks30d: data.summary.total_checks_30d,
      totalEvolutions: data.summary.total_evolutions,
      avgImprovement: data.summary.avg_improvement,
    },
    passRateTrend: data.pass_rate_trend.map((point) => ({
      date: point.date,
      passRate: point.pass_rate,
      checkVolume: point.total_checks,
    })),
    skillRankings: data.skill_rankings.map((skill, index) => ({
      skillName: skill.skill_name,
      passRate: skill.pass_rate,
      totalChecks: skill.total_checks,
      rank: index + 1,
    })),
    dailyActivity: data.daily_activity.map((day) => ({
      date: day.date,
      checks: day.checks,
    })),
    evolutionImpact: data.evolution_impact.map((entry) => ({
      skillName: entry.skill_name,
      passRateBefore: entry.pass_rate_before,
      passRateAfter: entry.pass_rate_after,
      improvement: entry.pass_rate_after - entry.pass_rate_before,
    })),
  };
}

async function fetchRuntimeHealth(): Promise<RuntimeHealthModel> {
  const response = await fetch("/api/health");
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as HealthResponse;
  return {
    workspaceRoot: payload.workspace_root,
    gitSha: payload.git_sha,
    dbPath: payload.db_path,
    processMode: payload.process_mode,
    watcherMode: payload.watcher_mode,
  };
}

async function updateOverviewWatchlist(skills: string[]): Promise<string[]> {
  const response = await fetch("/api/actions/watchlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skills }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { watched_skills?: string[] };
  return Array.isArray(payload.watched_skills) ? payload.watched_skills : skills;
}

export const localHostAdapter: DashboardHostAdapter = {
  useSession() {
    return {
      status: "authenticated",
      user: {
        name: "Admin Node",
        subtitle: "Active",
      },
    };
  },
  api: {
    async fetchOverview() {
      return mapOverviewModel(await fetchOverview());
    },
    async fetchSkills() {
      return mapSkillsModel(await fetchOverview());
    },
    async fetchAnalytics() {
      return mapAnalyticsModel(await fetchAnalytics());
    },
    fetchRuntimeHealth,
  },
  links: {
    upgrade: "https://selftune.dev/pricing",
    docs: "https://docs.selftune.dev",
    cloudDashboard: "https://selftune.dev",
  },
  actions: {
    openUpgrade() {
      if (typeof window !== "undefined") {
        window.open("https://selftune.dev/pricing", "_blank", "noopener,noreferrer");
      }
    },
    updateOverviewWatchlist,
  },
};
