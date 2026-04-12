export type OverviewAutonomyLevel = "healthy" | "watching" | "needs_review" | "blocked";
export type OverviewSeverity = "critical" | "warning" | "info";
export type OverviewTrustBucket = "at_risk" | "improving" | "uncertain" | "stable";
export type OverviewDecisionKind =
  | "proposal_created"
  | "proposal_rejected"
  | "validation_failed"
  | "proposal_deployed"
  | "rollback_triggered"
  | "regression_found";

export interface OverviewSummaryModel {
  totalSkills: number;
  avgPassRate30d: number | null;
  unmatchedCount30d: number;
  sessionsCount30d: number;
  pendingCount: number;
  evidenceCount: number;
}

export interface OverviewAutonomyModel {
  level: OverviewAutonomyLevel;
  summary: string;
  attentionRequired: number;
  skillsObserved: number;
  pendingReviews: number;
  lastRunAt: string | null;
}

export interface OverviewWatchlistEntryModel {
  skillName: string;
  bucket: OverviewTrustBucket;
  lastSeen: string | null;
  passRate: number | null;
  checks: number;
}

export interface OverviewAttentionItemModel {
  skillName: string;
  severity: OverviewSeverity;
  title: string;
  body: string;
}

export interface OverviewDecisionModel {
  skillName: string;
  kind: OverviewDecisionKind;
  timestamp: string;
  summary: string;
}

export interface OverviewActivityItemModel {
  id: string;
  type: "evolution" | "proposal" | "unmatched";
  skillName?: string;
  timestamp: string;
  title: string;
  summary: string;
}

export interface PipelineJobModel {
  id: string;
  label: string;
  status: "healthy" | "warning" | "error" | "idle";
  lastRunAt?: string | null;
  nextRunAt?: string | null;
}

export interface OverviewSignalsSummaryModel {
  signalCount: number;
  skillCount: number;
}

export interface OverviewSkillCardModel {
  id?: string;
  name: string;
  scope: string | null;
  platforms: string[];
  passRate: number | null;
  checks: number;
  status: "HEALTHY" | "WARNING" | "CRITICAL" | "UNKNOWN";
  hasEvidence: boolean;
  uniqueSessions: number;
  lastSeen: string | null;
}

export interface OverviewModel {
  version?: string;
  summary: OverviewSummaryModel;
  autonomy: OverviewAutonomyModel | null;
  skillCards: OverviewSkillCardModel[];
  watchlist: OverviewWatchlistEntryModel[];
  attention: OverviewAttentionItemModel[];
  decisions: OverviewDecisionModel[];
  activity: OverviewActivityItemModel[];
  jobs: PipelineJobModel[];
  signals: OverviewSignalsSummaryModel | null;
}
