import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { SkillTestingReadiness, SkillSummary } from "../../dashboard-contract.js";
import { computeCreateDashboardReadiness, isCreateSkillDraft } from "../../create/readiness.js";
import { iterateTrustedSkillObservationRows } from "./trust.js";
import { listSkillTestingReadiness } from "../../testing-readiness.js";
import { classifySkillPath } from "../../utils/skill-discovery.js";

export function getSkillsList(
  db: Database,
  testingReadinessRows?: SkillTestingReadiness[],
): SkillSummary[] {
  const bySkill = new Map<
    string,
    {
      checks: number;
      triggered: number;
      sessions: Set<string>;
      lastSeen: string | null;
      confidenceSum: number;
      confidenceCount: number;
    }
  >();

  for (const row of iterateTrustedSkillObservationRows(db)) {
    let totals = bySkill.get(row.skill_name);
    if (!totals) {
      totals = {
        checks: 0,
        triggered: 0,
        sessions: new Set(),
        lastSeen: null,
        confidenceSum: 0,
        confidenceCount: 0,
      };
      bySkill.set(row.skill_name, totals);
    }
    totals.checks++;
    if (row.triggered === 1) totals.triggered++;
    totals.sessions.add(row.session_id);
    if (
      row.occurred_at != null &&
      (totals.lastSeen == null || row.occurred_at.localeCompare(totals.lastSeen) > 0)
    ) {
      totals.lastSeen = row.occurred_at;
    }
    if (row.confidence != null) {
      totals.confidenceSum += row.confidence;
      totals.confidenceCount++;
    }
  }

  const evidenceSkills = new Set(
    db
      .query<
        {
          skill_name: string;
        },
        SQLQueryBindings[]
      >(`SELECT DISTINCT skill_name FROM evolution_evidence`)
      .all()
      .map((row) => row.skill_name),
  );

  const skillScopeRows = db
    .query<{ skill_name: string; skill_scope: string | null }, SQLQueryBindings[]>(
      `SELECT
         si.skill_name,
         COALESCE(
           (SELECT s2.skill_scope FROM skill_invocations s2
            WHERE s2.skill_name = si.skill_name AND s2.skill_scope IS NOT NULL
            ORDER BY s2.occurred_at DESC LIMIT 1),
           (SELECT su.skill_scope FROM skill_usage su
            WHERE su.skill_name = si.skill_name AND su.skill_scope IS NOT NULL
            ORDER BY su.timestamp DESC LIMIT 1)
         ) as skill_scope
       FROM skill_invocations si
       GROUP BY si.skill_name`,
    )
    .all();
  const scopeBySkill = new Map(skillScopeRows.map((row) => [row.skill_name, row.skill_scope]));
  const testingReadiness = testingReadinessRows ?? listSkillTestingReadiness(db);
  const testingReadinessBySkill = new Map(
    testingReadiness.map((row) => [row.skill_name, row] as const),
  );
  const createReadinessBySkill = new Map(
    testingReadiness
      .flatMap((row) => {
        if (!row.skill_path || !isCreateSkillDraft(row.skill_path)) return [];
        try {
          return [
            [
              row.skill_name,
              computeCreateDashboardReadiness(row.skill_path, {
                getTestingReadiness: () => row,
              }),
            ] as const,
          ];
        } catch {
          return [];
        }
      })
      .filter(Boolean),
  );
  const knownSkills = new Set<string>(bySkill.keys());
  for (const skillName of createReadinessBySkill.keys()) {
    knownSkills.add(skillName);
  }

  return [...knownSkills]
    .map((skillName) => {
      const totals = bySkill.get(skillName);
      const totalChecks = totals?.checks ?? 0;
      const triggeredCount = totals?.triggered ?? 0;
      const uniqueSessions = totals?.sessions.size ?? 0;
      const lastSeen = totals?.lastSeen ?? null;
      const confidenceCount = totals?.confidenceCount ?? 0;
      const routingConfidence =
        totals && confidenceCount > 0 ? totals.confidenceSum / confidenceCount : null;
      const readiness = testingReadinessBySkill.get(skillName);
      const createReadiness = createReadinessBySkill.get(skillName);
      const fallbackScope =
        readiness?.skill_path != null ? classifySkillPath(readiness.skill_path).skill_scope : null;
      const createScope =
        createReadiness?.skill_path != null
          ? classifySkillPath(createReadiness.skill_path).skill_scope
          : null;

      return {
        skill_name: skillName,
        skill_scope:
          scopeBySkill.get(skillName) ??
          (createScope && createScope !== "unknown" ? createScope : null) ??
          (fallbackScope && fallbackScope !== "unknown" ? fallbackScope : null),
        total_checks: totalChecks,
        triggered_count: triggeredCount,
        pass_rate: totalChecks > 0 ? triggeredCount / totalChecks : 0,
        unique_sessions: uniqueSessions,
        last_seen: lastSeen,
        has_evidence: evidenceSkills.has(skillName),
        routing_confidence: routingConfidence,
        confidence_coverage: totalChecks > 0 ? confidenceCount / totalChecks : 0,
        testing_readiness: readiness,
        create_readiness: createReadiness,
      };
    })
    .sort(
      (a, b) =>
        b.total_checks - a.total_checks ||
        (b.last_seen ?? "").localeCompare(a.last_seen ?? "") ||
        a.skill_name.localeCompare(b.skill_name),
    );
}
