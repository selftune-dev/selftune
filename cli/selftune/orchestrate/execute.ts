import {
  deriveExpectationsFromSkill,
  gradeSession,
  resolveLatestSessionForSkill,
} from "../grading/grade-session.js";
import type { readGradingResultsForSkill } from "../grading/results.js";
import { writeGradingBaseline, writeGradingResultToDb } from "../localdb/direct-write.js";
import type { watch as watchSkill } from "../monitoring/watch.js";
import type { EvolveOptions, evolve as evolveSkill } from "../evolution/evolve.js";
import type { ReplayValidationOptions } from "../evolution/engines/replay-engine.js";
import { buildRuntimeReplayValidationOptions } from "../evolution/validate-host-replay.js";
import { findRecentlyDeployedSkills } from "./plan.js";
import type { OrchestrateOptions, SkillAction } from "../orchestrate.js";
import type { EvolutionAuditEntry, SessionTelemetryRecord, SkillUsageRecord } from "../types.js";
import { readExcerpt } from "../utils/transcript.js";

export interface ReplayOptionBuildInput {
  skillName: string;
  skillPath: string;
  agent: string | null;
}

export function buildReplayValidationOptions(
  input: ReplayOptionBuildInput,
): ReplayValidationOptions | undefined {
  const { skillName, skillPath, agent } = input;
  if (!agent) return undefined;

  return buildRuntimeReplayValidationOptions({
    skillName,
    skillPath,
    agent,
    contentTarget: "description",
  });
}

export interface RunEvolutionPhaseInput {
  evolveCandidates: SkillAction[];
  agent: string | null;
  options: Pick<OrchestrateOptions, "approvalMode" | "dryRun">;
  resolveSkillPath: (skillName: string) => string | undefined;
  readGradingResults: typeof readGradingResultsForSkill;
  evolve: typeof evolveSkill;
  buildReplayOptions: typeof buildReplayValidationOptions;
  evolveDefaults: Pick<
    EvolveOptions,
    | "paretoEnabled"
    | "candidateCount"
    | "tokenEfficiencyEnabled"
    | "withBaseline"
    | "validationModel"
    | "cheapLoop"
    | "gateModel"
    | "adaptiveGate"
    | "proposalModel"
  >;
}

export async function runEvolutionPhase(input: RunEvolutionPhaseInput): Promise<SkillAction[]> {
  const {
    evolveCandidates,
    agent,
    options,
    resolveSkillPath,
    readGradingResults,
    evolve,
    buildReplayOptions,
    evolveDefaults,
  } = input;

  if (!agent) return [];

  for (const candidate of evolveCandidates) {
    if (candidate.action === "skip") continue;

    const skillPath = resolveSkillPath(candidate.skill);
    if (!skillPath) {
      candidate.action = "skip";
      candidate.reason = `SKILL.md not found for "${candidate.skill}"`;
      console.error(`  ⊘ ${candidate.skill}: ${candidate.reason}`);
      continue;
    }

    const effectiveDryRun = options.dryRun || options.approvalMode === "review";
    console.error(
      `[orchestrate] Evolving "${candidate.skill}"${effectiveDryRun ? " (dry-run)" : ""}...`,
    );

    try {
      const evolveResult = await evolve({
        skillName: candidate.skill,
        skillPath,
        agent,
        dryRun: effectiveDryRun,
        confidenceThreshold: 0.6,
        maxIterations: 3,
        gradingResults: readGradingResults(candidate.skill),
        syncFirst: false,
        replayOptions: buildReplayOptions({
          skillName: candidate.skill,
          skillPath,
          agent,
        }),
        ...evolveDefaults,
      });

      candidate.evolveResult = evolveResult;

      if (evolveResult.deployed) {
        console.error(`  ✓ ${candidate.skill}: deployed (${evolveResult.reason})`);
      } else {
        console.error(`  ✗ ${candidate.skill}: not deployed (${evolveResult.reason})`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      candidate.action = "skip";
      candidate.reason = `evolve error: ${msg}`;
      console.error(`  ✗ ${candidate.skill}: error — ${msg}`);
    }
  }

  return evolveCandidates.filter(
    (candidate) => candidate.action === "evolve" && candidate.evolveResult?.deployed,
  );
}

export interface AutoGradeFreshDeploysInput {
  freshlyDeployedCandidates: SkillAction[];
  dryRun: boolean;
  agent: string | null;
  detectAgent: () => string | null;
  readTelemetry: () => SessionTelemetryRecord[];
  readSkillRecords: () => SkillUsageRecord[];
}

export async function autoGradeFreshDeploys(input: AutoGradeFreshDeploysInput): Promise<void> {
  const { freshlyDeployedCandidates, dryRun, agent, detectAgent, readTelemetry, readSkillRecords } =
    input;

  if (dryRun || freshlyDeployedCandidates.length === 0) return;

  const gradeAgent = agent ?? detectAgent();
  if (!gradeAgent) return;

  for (const candidate of freshlyDeployedCandidates) {
    try {
      const freshTelemetry = readTelemetry();
      const freshSkillUsage = readSkillRecords();
      let gradedCount = 0;
      const gradingPassRates: number[] = [];

      const resolved = resolveLatestSessionForSkill(
        freshTelemetry,
        freshSkillUsage,
        candidate.skill,
      );
      if (resolved) {
        const derived = deriveExpectationsFromSkill(candidate.skill);
        let transcriptExcerpt = "(no transcript)";
        if (resolved.transcriptPath) {
          try {
            transcriptExcerpt = readExcerpt(resolved.transcriptPath);
          } catch {
            transcriptExcerpt = "(no transcript)";
          }
        }

        const result = await gradeSession({
          expectations: derived.expectations,
          telemetry: resolved.telemetry,
          sessionId: resolved.sessionId,
          skillName: candidate.skill,
          transcriptExcerpt,
          transcriptPath: resolved.transcriptPath,
          agent: gradeAgent,
        });

        const persisted = writeGradingResultToDb(result);
        if (persisted) {
          gradedCount++;
          gradingPassRates.push(result.summary.pass_rate);
        }
      }

      if (gradedCount > 0) {
        const avgPassRate =
          gradingPassRates.reduce((sum, passRate) => sum + passRate, 0) / gradingPassRates.length;
        const proposalId = candidate.evolveResult?.auditEntries?.find(
          (entry: { action: string }) => entry.action === "deployed",
        )?.proposal_id;

        writeGradingBaseline({
          skill_name: candidate.skill,
          proposal_id: proposalId ?? null,
          measured_at: new Date().toISOString(),
          pass_rate: avgPassRate,
          mean_score: null,
          sample_size: gradedCount,
          grading_results_json: JSON.stringify(gradingPassRates),
        });

        console.error(
          `  [post-deploy] ${candidate.skill}: graded ${gradedCount} session(s), baseline pass_rate=${avgPassRate.toFixed(2)}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [post-deploy] ${candidate.skill}: auto-grade error — ${msg}`);
    }
  }
}

export interface WatchRecentDeploysInput {
  candidates: SkillAction[];
  freshlyDeployedCandidates: SkillAction[];
  skillFilter?: string;
  recentWindowHours: number;
  readAuditEntries: () => EvolutionAuditEntry[];
  resolveSkillPath: (skillName: string) => string | undefined;
  watch: typeof watchSkill;
}

export async function watchRecentDeploys(
  input: WatchRecentDeploysInput,
): Promise<{ freshAuditEntries: EvolutionAuditEntry[]; freshlyWatchedSkills: string[] }> {
  const {
    candidates,
    freshlyDeployedCandidates,
    skillFilter,
    recentWindowHours,
    readAuditEntries,
    resolveSkillPath,
    watch,
  } = input;

  const freshAuditEntries = readAuditEntries();
  const recentlyEvolved = findRecentlyDeployedSkills(freshAuditEntries, recentWindowHours);

  for (const candidate of freshlyDeployedCandidates) {
    recentlyEvolved.add(candidate.skill);
  }

  const freshlyWatchedSkills: string[] = [];

  for (const skillName of recentlyEvolved) {
    if (skillFilter && skillName !== skillFilter) continue;

    const skillPath = resolveSkillPath(skillName);
    if (!skillPath) continue;

    const isFreshlyDeployed = freshlyDeployedCandidates.some(
      (candidate) => candidate.skill === skillName,
    );
    const label = isFreshlyDeployed ? "freshly deployed" : "recently evolved";
    console.error(`[orchestrate] Watching "${skillName}" (${label})...`);

    try {
      const watchResult = await watch({
        skillName,
        skillPath,
        windowSessions: 20,
        regressionThreshold: 0.1,
        autoRollback: true,
        enableGradeWatch: true,
        syncFirst: false,
      });

      if (isFreshlyDeployed) {
        const existingCandidate = candidates.find(
          (candidate) => candidate.skill === skillName && candidate.action === "evolve",
        );
        if (existingCandidate) {
          existingCandidate.watchResult = watchResult;
        }
        freshlyWatchedSkills.push(skillName);
      } else {
        candidates.push({
          skill: skillName,
          action: "watch",
          reason: watchResult.alert ?? "stable",
          watchResult,
        });
      }

      console.error(
        `  ${watchResult.alert ? "⚠" : "✓"} ${skillName}: ${watchResult.recommendation}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${skillName}: watch error — ${msg}`);
    }
  }

  return { freshAuditEntries, freshlyWatchedSkills };
}
