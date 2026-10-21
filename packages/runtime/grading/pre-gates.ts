import type { GradingExpectation, SessionTelemetryRecord } from "../types.js";

export interface PreGateContext {
  telemetry: Partial<SessionTelemetryRecord>;
  skillName: string;
  transcriptExcerpt?: string;
}

export interface PreGateResult {
  resolved: GradingExpectation[];
  remaining: string[];
}

/** Resolve only a recorded trigger, not file reads, ordering, completion, or quality. */
export function runPreGates(expectations: string[], ctx: PreGateContext): PreGateResult {
  const resolved: GradingExpectation[] = [];
  const remaining: string[] = [];
  const triggerClaims = [
    "The skill was triggered during the session",
    `The "${ctx.skillName}" skill was triggered during the session`,
  ];
  for (const text of expectations) {
    if (triggerClaims.includes(text) && ctx.telemetry.skills_triggered?.includes(ctx.skillName)) {
      resolved.push({
        text,
        passed: true,
        evidence: `telemetry.skills_triggered includes ${JSON.stringify(ctx.skillName)}`,
        score: 1,
        source: "pre-gate",
      });
    } else {
      remaining.push(text);
    }
  }
  return { resolved, remaining };
}
