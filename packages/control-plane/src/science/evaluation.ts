import { createHash } from "node:crypto";

import {
  GeneratedEvalCase,
  ReleaseRecommendation,
  type ReleaseGateInput,
  type SynthesisCandidate,
} from "../domain";

const round = (value: number): number => Math.round(value * 10_000) / 10_000;
const id = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 20);

export function generateCandidateEvals(
  snapshotId: string,
  candidate: SynthesisCandidate,
  targetSkillName?: string,
): Array<typeof GeneratedEvalCase.Type> {
  const expected = [targetSkillName ?? candidate.title];
  const supportingExamples =
    candidate.supportingExamples ??
    candidate.redactedExcerpts.map((excerpt) => ({ sessionId: null, excerpt }));
  const cases = supportingExamples.map((example) =>
    GeneratedEvalCase.make({
      evalId: `positive-${id(`${candidate.candidateId}:${example.sessionId ?? "legacy"}:${example.excerpt}`)}`,
      kind: "positive",
      query: example.excerpt,
      expectedSkillNames: expected,
      sourceSessionIds: example.sessionId === null ? [] : [example.sessionId],
      evidenceSnapshotId: snapshotId,
      heldOut: false,
    }),
  );
  const heldOutExamples = candidate.heldOutExamples ?? [];
  cases.push(
    ...heldOutExamples.map((example) =>
      GeneratedEvalCase.make({
        evalId: `execution-${id(`${candidate.candidateId}:${example.sessionId}:${example.excerpt}`)}`,
        kind: "execution",
        query: example.excerpt,
        expectedSkillNames: expected,
        sourceSessionIds: [example.sessionId],
        evidenceSnapshotId: snapshotId,
        heldOut: true,
      }),
    ),
  );
  return cases;
}

export function evaluateReleaseGate(input: ReleaseGateInput): typeof ReleaseRecommendation.Type {
  const blockers: string[] = [];
  const measuredCaseCounts = [
    input.draft.caseCount,
    ...input.baselines.map((baseline) => baseline.caseCount),
  ];
  if (measuredCaseCounts.some((caseCount) => !Number.isInteger(caseCount) || caseCount <= 0)) {
    blockers.push("Every evaluation arm must include at least one measured case.");
  }
  if (!input.packageValid) blockers.push("Package validation has not passed.");
  if (!input.replayPassed) blockers.push("Package replay has not passed.");
  if (input.draft.regressions.length > 0) blockers.push("Draft evaluation contains regressions.");

  const comparison = input.baselines.find((baseline) => baseline.baseline === "no_skill");
  const strongestBaseline = input.baselines.reduce(
    (strongest, current) =>
      current.outcomeQuality > strongest.outcomeQuality ? current : strongest,
    input.baselines[0] ?? input.draft,
  );
  const outcomeLift = round(input.draft.outcomeQuality - strongestBaseline.outcomeQuality);
  const activationRegression = round(
    strongestBaseline.activationAccuracy - input.draft.activationAccuracy,
  );
  if (!comparison) blockers.push("A no-skill baseline is required.");
  if (outcomeLift < input.minimumOutcomeLift) {
    blockers.push(`Held-out outcome lift ${outcomeLift} is below ${input.minimumOutcomeLift}.`);
  }
  if (activationRegression > input.maximumActivationRegression) {
    blockers.push("Activation accuracy regressed beyond the allowed threshold.");
  }
  for (const baseline of input.baselines) {
    if (baseline.regressions.length > 0)
      blockers.push(`${baseline.baseline} baseline has regressions.`);
  }

  return ReleaseRecommendation.make({
    candidateId: input.candidateId,
    recommended: blockers.length === 0,
    outcomeLift,
    contextTokenDelta: input.draft.contextTokens - strongestBaseline.contextTokens,
    blockers,
  });
}
