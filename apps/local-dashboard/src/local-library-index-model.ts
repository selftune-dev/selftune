import type { LibraryIndexPage } from "@selftune/control-plane/library-index";
import type { LibraryInventoryModel } from "@selftune/dashboard-core/models";
import { LOCAL_LIBRARY_CATEGORY_OPTIONS, uniqueSources } from "./local-library-model";
import type {
  AnalyticsResponse,
  HarnessConnection,
  PortfolioResponse,
  SkillIntelligenceReport,
} from "./types";

export function mapLocalLibraryIndex(
  index: LibraryIndexPage,
  intelligence: SkillIntelligenceReport | null,
  portfolio: PortfolioResponse | null,
  harnesses: readonly HarnessConnection[],
  analytics: AnalyticsResponse | null,
): LibraryInventoryModel {
  const classifications = new Map(
    intelligence?.classifications.map((item) => [item.skill_id.toLowerCase(), item]),
  );
  const connections = new Map(harnesses.map((item) => [item.id, item]));
  const trends = new Map(
    analytics?.skill_trigger_trends?.map((item) => [item.skill_name.toLowerCase(), item.points]),
  );
  const counts = new Map(
    analytics?.skill_rankings.map((item) => [item.skill_name.toLowerCase(), item.triggered_count]),
  );
  const quarantined = new Map<string, string>();
  for (const item of portfolio?.quarantined ?? [])
    if (item.status === "quarantined" && !quarantined.has(item.skill_name.toLowerCase()))
      quarantined.set(item.skill_name.toLowerCase(), item.quarantine_id);
  const candidates = new Map<string, boolean>();
  for (const item of portfolio?.audit.skills ?? [])
    if (!candidates.has(item.skill_name.toLowerCase()))
      candidates.set(
        item.skill_name.toLowerCase(),
        item.classification === "inactive_candidate" && item.recommendation === "review_quarantine",
      );
  return {
    categoryOptions: LOCAL_LIBRARY_CATEGORY_OPTIONS,
    skills: index.skills.map((skill) => {
      const classification = classifications.get(skill.skillId.toLowerCase());
      return {
        id: skill.skillId,
        name: skill.name,
        lifecycle: skill.lifecycle,
        status: skill.lifecycle === "active" ? "Ready" : "Stored",
        updateStatus: skill.updateStatus,
        detailsLoaded: false,
        consolidationAvailable: skill.consolidationAvailable,
        archiveAvailable:
          skill.installedCount === 1 && candidates.get(skill.name.toLowerCase()) === true,
        category: classification
          ? {
              id: classification.category,
              label: classification.category_label,
              inferredId: classification.inferred_category,
              source: classification.source,
              confidence: classification.confidence,
              reason: classification.reason,
              overrideReason: classification.override_reason,
              matchedTerms: classification.matched_terms,
            }
          : null,
        sources: uniqueSources(
          skill.origins.map((origin) => ({
            kind: origin.kind === "github" ? "github" : origin.kind === "local" ? "local" : "other",
            label: origin.label,
            href: origin.url,
            path: origin.packagePath,
          })),
        ),
        locations: skill.connections.map((location) => ({
          id: `${location.harness}:${location.packagePath}`,
          label: location.scope === "global" ? "Global" : location.scope,
          path: location.packagePath,
          sourceKind: location.sourceKind,
          connection: location.harness
            ? (connections.get(location.harness)?.name ?? location.harness)
            : null,
          connectionIcon: location.harness
            ? (connections.get(location.harness)?.icon ?? null)
            : null,
          removable: location.removable,
        })),
        revisionHashes: [...skill.revisionHashes],
        lastUsedAt: skill.lastUsedAt,
        modifiedAt: skill.lastModifiedAt,
        instructionBytes: skill.instructionBytes ?? null,
        triggerTrend: trends.get(skill.name.toLowerCase()) ?? [],
        lifetimeTriggerCount: counts.get(skill.name.toLowerCase()) ?? (analytics ? 0 : null),
        restoreId: quarantined.get(skill.name.toLowerCase()) ?? null,
        detailHref: `/skills/${encodeURIComponent(skill.name)}`,
      };
    }),
  };
}
