export type SkillHealthStatus = "HEALTHY" | "WARNING" | "CRITICAL" | "UNKNOWN";

export interface SkillListItemModel {
  id?: string;
  name: string;
  platforms: string[];
  status: SkillHealthStatus;
  passRate: number | null;
  totalChecks: number;
  uniqueSessions: number;
  evidenceCount?: number;
  lastSeen: string | null;
}

export interface SkillTrendPointModel {
  date: string;
  passRate: number | null;
  checks: number;
}

export interface SkillDetailModel {
  id?: string;
  name: string;
  status: SkillHealthStatus;
  passRate: number | null;
  totalChecks: number;
  uniqueSessions: number;
  lastSeen: string | null;
  trends: SkillTrendPointModel[];
}

export interface SkillsModel {
  items: SkillListItemModel[];
}
