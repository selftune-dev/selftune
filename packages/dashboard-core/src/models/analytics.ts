export interface PassRateTrendPointModel {
  date: string;
  passRate: number | null;
  checkVolume: number;
}

export interface SkillRankingModel {
  skillName: string;
  passRate: number;
  totalChecks: number;
  rank?: number;
}

export interface DailyActivityModel {
  date: string;
  checks: number;
}

export interface EvolutionImpactModel {
  skillName: string;
  passRateBefore: number;
  passRateAfter: number;
  improvement: number;
}

export interface AnalyticsSummaryModel {
  activeSkills: number;
  totalChecks30d: number;
  totalEvolutions: number;
  avgImprovement: number;
}

export interface AnalyticsModel {
  summary: AnalyticsSummaryModel;
  passRateTrend: PassRateTrendPointModel[];
  skillRankings: SkillRankingModel[];
  dailyActivity: DailyActivityModel[];
  evolutionImpact: EvolutionImpactModel[];
}
