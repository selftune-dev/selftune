import type { EvolutionEntry, TrustBucket } from "@selftune/ui/types";

export interface OverviewComparisonRow {
  skillName: string;
  subtext?: string | null;
  triggerRate: number | null;
  routingConfidence: number | null;
  confidenceCoverage: number;
  sessions: number;
  lastEvolution: EvolutionEntry | null;
  bucket: TrustBucket;
  sortTimestamp?: string | null;
}
