/**
 * selftune orchestrate — Autonomous core loop: sync → status → evolve → watch.
 *
 * This is the single entry point for the closed-loop improvement cycle.
 * It chains existing modules (sync, status, evolve, watch) into one
 * coordinated run with explicit candidate selection and safety controls.
 *
 * Default behavior is safe: dry-run mode, no deployments without --auto-approve.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { EVOLUTION_AUDIT_LOG, QUERY_LOG, TELEMETRY_LOG } from "./constants.js";
import type { EvolveResult } from "./evolution/evolve.js";
import { readGradingResultsForSkill } from "./grading/results.js";
import type { WatchResult } from "./monitoring/watch.js";
import { doctor } from "./observability.js";
import type { SkillStatus, StatusResult } from "./status.js";
import { computeStatus } from "./status.js";
import type { SyncResult } from "./sync.js";
import { createDefaultSyncOptions, syncSources } from "./sync.js";
import type { EvolutionAuditEntry, QueryLogRecord, SessionTelemetryRecord } from "./types.js";
import { readJsonl } from "./utils/jsonl.js";
import { detectAgent } from "./utils/llm-call.js";
import {
  findInstalledSkillPath,
  findRepositoryClaudeSkillDirs,
  findRepositorySkillDirs,
} from "./utils/skill-discovery.js";
import { readEffectiveSkillUsageRecords } from "./utils/skill-log.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrchestrateOptions {
  /** Run sync → status → evolve → watch without writing changes. */
  dryRun: boolean;
  /** Allow evolve to deploy changes (without this, evolve always uses dry-run). */
  autoApprove: boolean;
  /** Scope to a single skill by name. */
  skillFilter?: string;
  /** Cap the number of skills processed per run. */
  maxSkills: number;
  /** Hours to look back for recently-evolved skills to watch. */
  recentWindowHours: number;
  /** Force sync to rescan all sources. */
  syncForce: boolean;
}

export interface SkillAction {
  skill: string;
  action: "evolve" | "watch" | "skip";
  reason: string;
  evolveResult?: EvolveResult;
  watchResult?: WatchResult;
}

export interface OrchestrateResult {
  syncResult: SyncResult;
  statusResult: StatusResult;
  candidates: SkillAction[];
  summary: {
    totalSkills: number;
    evaluated: number;
    evolved: number;
    deployed: number;
    watched: number;
    skipped: number;
    dryRun: boolean;
    autoApprove: boolean;
    elapsedMs: number;
  };
}

// ---------------------------------------------------------------------------
// Human-readable decision report
// ---------------------------------------------------------------------------

function formatSyncPhase(syncResult: SyncResult): string[] {
  const lines: string[] = ["Phase 1: Sync"];
  const sources: [string, keyof SyncResult["sources"]][] = [
    ["Claude", "claude"],
    ["Codex", "codex"],
    ["OpenCode", "opencode"],
    ["OpenClaw", "openclaw"],
  ];

  for (const [label, key] of sources) {
    const s = syncResult.sources[key];
    if (!s.available) {
      lines.push(`  ${label.padEnd(12)}not available`);
    } else if (s.synced > 0) {
      lines.push(`  ${label.padEnd(12)}scanned ${s.scanned}, synced ${s.synced}`);
    } else {
      lines.push(`  ${label.padEnd(12)}scanned ${s.scanned}, up to date`);
    }
  }

  if (syncResult.repair.ran && syncResult.repair.repaired_records > 0) {
    lines.push(
      `  Repair      ${syncResult.repair.repaired_records} records across ${syncResult.repair.repaired_sessions} sessions`,
    );
  }

  return lines;
}

function formatStatusPhase(statusResult: StatusResult): string[] {
  const lines: string[] = ["Phase 2: Status"];
  const byStatus: Record<string, number> = {};
  for (const skill of statusResult.skills) {
    byStatus[skill.status] = (byStatus[skill.status] ?? 0) + 1;
  }
  const healthLabel = statusResult.system.healthy ? "healthy" : "UNHEALTHY";
  lines.push(`  ${statusResult.skills.length} skills found, system ${healthLabel}`);

  const parts: string[] = [];
  for (const s of ["CRITICAL", "WARNING", "HEALTHY", "UNGRADED", "UNKNOWN"]) {
    if (byStatus[s]) parts.push(`${byStatus[s]} ${s}`);
  }
  if (parts.length > 0) lines.push(`  ${parts.join(", ")}`);

  return lines;
}

function formatDecisionPhase(candidates: SkillAction[]): string[] {
  const lines: string[] = ["Phase 3: Skill Decisions"];
  if (candidates.length === 0) {
    lines.push("  (no skills to evaluate)");
    return lines;
  }

  for (const c of candidates) {
    const icon = c.action === "skip" ? "\u2298" : c.action === "watch" ? "\u25cb" : "\u2192";
    const actionLabel = c.action.toUpperCase().padEnd(7);
    lines.push(`  ${icon} ${c.skill.padEnd(20)} ${actionLabel} ${c.reason}`);
  }

  return lines;
}

function formatEvolutionPhase(candidates: SkillAction[]): string[] {
  const evolved = candidates.filter((c) => c.action === "evolve" && c.evolveResult !== undefined);
  if (evolved.length === 0) return [];

  const lines: string[] = ["Phase 4: Evolution Results"];
  for (const c of evolved) {
    const r = c.evolveResult;
    if (!r) continue;
    const status = r.deployed ? "deployed" : "not deployed";
    const detail = r.reason;
    const validation = r.validation
      ? ` (${(r.validation.before_pass_rate * 100).toFixed(0)}% \u2192 ${(r.validation.after_pass_rate * 100).toFixed(0)}%)`
      : "";
    lines.push(`  ${c.skill.padEnd(20)} ${status}${validation}`);
    lines.push(`  ${"".padEnd(20)} ${detail}`);
  }

  return lines;
}

function formatWatchPhase(candidates: SkillAction[]): string[] {
  const watched = candidates.filter((c) => c.action === "watch");
  if (watched.length === 0) return [];

  const lines: string[] = ["Phase 5: Watch"];
  for (const c of watched) {
    const snap = c.watchResult?.snapshot;
    const passInfo = snap ? `pass_rate=${snap.pass_rate.toFixed(2)}` : "";
    const baseInfo = snap ? `, baseline=${snap.baseline_pass_rate.toFixed(2)}` : "";
    const alertTag = c.watchResult?.alert ? " [ALERT]" : "";
    lines.push(`  ${c.skill.padEnd(20)} ${c.reason}${alertTag} (${passInfo}${baseInfo})`);
  }

  return lines;
}

export function formatOrchestrateReport(result: OrchestrateResult): string {
  const sep = "\u2550".repeat(48);
  const lines: string[] = [];

  lines.push(sep);
  lines.push("selftune orchestrate \u2014 decision report");
  lines.push(sep);
  lines.push("");

  // Mode banner
  if (result.summary.dryRun) {
    lines.push("Mode: DRY RUN (pass --auto-approve to deploy)");
  } else if (result.summary.autoApprove) {
    lines.push("Mode: AUTO-APPROVE (changes will be deployed)");
  } else {
    lines.push("Mode: LIVE (proposals validated but not deployed)");
  }
  lines.push("");

  // Phase 1: Sync
  lines.push(...formatSyncPhase(result.syncResult));
  lines.push("");

  // Phase 2: Status
  lines.push(...formatStatusPhase(result.statusResult));
  lines.push("");

  // Phase 3: Skill decisions
  lines.push(...formatDecisionPhase(result.candidates));
  lines.push("");

  // Phase 4: Evolution results (only if any evolve ran)
  const evoLines = formatEvolutionPhase(result.candidates);
  if (evoLines.length > 0) {
    lines.push(...evoLines);
    lines.push("");
  }

  // Phase 5: Watch (only if any watched)
  const watchLines = formatWatchPhase(result.candidates);
  if (watchLines.length > 0) {
    lines.push(...watchLines);
    lines.push("");
  }

  // Final summary
  lines.push("Summary");
  lines.push(`  Evaluated:    ${result.summary.evaluated} skills`);
  lines.push(`  Deployed:     ${result.summary.deployed}`);
  lines.push(`  Watched:      ${result.summary.watched}`);
  lines.push(`  Skipped:      ${result.summary.skipped}`);
  lines.push(`  Elapsed:      ${(result.summary.elapsedMs / 1000).toFixed(1)}s`);

  return lines.join("\n");
}

/** Candidate selection criteria. */
const CANDIDATE_STATUSES = new Set(["CRITICAL", "WARNING", "UNGRADED"]);

/**
 * Injectable dependencies for orchestrate(). Pass overrides in tests.
 */
export interface OrchestrateDeps {
  syncSources?: typeof syncSources;
  computeStatus?: typeof computeStatus;
  evolve?: typeof import("./evolution/evolve.js").evolve;
  watch?: typeof import("./monitoring/watch.js").watch;
  detectAgent?: typeof detectAgent;
  doctor?: typeof doctor;
  readTelemetry?: () => SessionTelemetryRecord[];
  readSkillRecords?: () => ReturnType<typeof readEffectiveSkillUsageRecords>;
  readQueryRecords?: () => QueryLogRecord[];
  readAuditEntries?: () => EvolutionAuditEntry[];
  resolveSkillPath?: (skillName: string) => string | undefined;
  readGradingResults?: (skillName: string) => ReturnType<typeof readGradingResultsForSkill>;
}

// ---------------------------------------------------------------------------
// Skill path resolution
// ---------------------------------------------------------------------------

function getSkillSearchDirs(): string[] {
  const home = homedir();
  const cwd = process.cwd();
  return [
    join(home, ".claude", "skills"),
    join(home, ".agents", "skills"),
    join(home, ".codex", "skills"),
    ...findRepositorySkillDirs(cwd),
    ...findRepositoryClaudeSkillDirs(cwd),
  ];
}

function defaultResolveSkillPath(skillName: string): string | undefined {
  return findInstalledSkillPath(skillName, getSkillSearchDirs());
}

// ---------------------------------------------------------------------------
// Candidate selection
// ---------------------------------------------------------------------------

export function selectCandidates(
  skills: SkillStatus[],
  options: Pick<OrchestrateOptions, "skillFilter" | "maxSkills">,
): SkillAction[] {
  const actions: SkillAction[] = [];

  for (const skill of skills) {
    // Apply skill filter
    if (options.skillFilter && skill.name !== options.skillFilter) {
      actions.push({
        skill: skill.name,
        action: "skip",
        reason: `filtered out (--skill ${options.skillFilter})`,
      });
      continue;
    }

    // Check if skill is a candidate
    if (!CANDIDATE_STATUSES.has(skill.status)) {
      actions.push({
        skill: skill.name,
        action: "skip",
        reason: `status=${skill.status} — no action needed`,
      });
      continue;
    }

    // UNGRADED: only evolve if there are missed queries (some signal)
    if (skill.status === "UNGRADED" && skill.missedQueries === 0) {
      actions.push({
        skill: skill.name,
        action: "skip",
        reason: "UNGRADED with 0 missed queries — insufficient signal",
      });
      continue;
    }

    actions.push({
      skill: skill.name,
      action: "evolve",
      reason: `status=${skill.status}, passRate=${skill.passRate !== null ? `${(skill.passRate * 100).toFixed(0)}%` : "—"}, missed=${skill.missedQueries}`,
    });
  }

  // Apply max-skills cap to evolve candidates only
  let evolveCount = 0;
  for (const action of actions) {
    if (action.action === "evolve") {
      evolveCount++;
      if (evolveCount > options.maxSkills) {
        action.action = "skip";
        action.reason = `capped by --max-skills ${options.maxSkills}`;
      }
    }
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Recently evolved detection
// ---------------------------------------------------------------------------

function findRecentlyEvolvedSkills(
  auditEntries: EvolutionAuditEntry[],
  windowHours: number,
): Set<string> {
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  const names = new Set<string>();

  for (const entry of auditEntries) {
    if (entry.action === "deployed" && entry.timestamp >= cutoff && entry.skill_name) {
      names.add(entry.skill_name);
    }
  }

  return names;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export async function orchestrate(
  options: OrchestrateOptions,
  deps: OrchestrateDeps = {},
): Promise<OrchestrateResult> {
  const startTime = Date.now();

  const _syncSources = deps.syncSources ?? syncSources;
  const _computeStatus = deps.computeStatus ?? computeStatus;
  const _detectAgent = deps.detectAgent ?? detectAgent;
  const _doctor = deps.doctor ?? doctor;
  const _readTelemetry =
    deps.readTelemetry ?? (() => readJsonl<SessionTelemetryRecord>(TELEMETRY_LOG));
  const _readSkillRecords = deps.readSkillRecords ?? readEffectiveSkillUsageRecords;
  const _readQueryRecords = deps.readQueryRecords ?? (() => readJsonl<QueryLogRecord>(QUERY_LOG));
  const _readAuditEntries =
    deps.readAuditEntries ?? (() => readJsonl<EvolutionAuditEntry>(EVOLUTION_AUDIT_LOG));
  const _resolveSkillPath = deps.resolveSkillPath ?? defaultResolveSkillPath;
  const _readGradingResults = deps.readGradingResults ?? readGradingResultsForSkill;

  // Lazy-load evolve and watch to avoid circular imports
  const _evolve = deps.evolve ?? (await import("./evolution/evolve.js")).evolve;
  const _watch = deps.watch ?? (await import("./monitoring/watch.js")).watch;

  // -------------------------------------------------------------------------
  // Step 1: Sync source-truth telemetry (mandatory)
  // -------------------------------------------------------------------------
  console.error("[orchestrate] Syncing source-truth telemetry...");
  const syncResult = _syncSources(createDefaultSyncOptions({ force: options.syncForce }));
  const sourceSynced = Object.values(syncResult.sources).reduce((sum, s) => sum + s.synced, 0);
  console.error(
    `[orchestrate] Sync complete: ${sourceSynced} sessions synced, ${syncResult.repair.repaired_records} repaired`,
  );

  // -------------------------------------------------------------------------
  // Step 2: Compute status
  // -------------------------------------------------------------------------
  console.error("[orchestrate] Computing skill status...");
  const telemetry = _readTelemetry();
  const skillRecords = _readSkillRecords();
  const queryRecords = _readQueryRecords();
  const auditEntries = _readAuditEntries();
  const doctorResult = _doctor();

  const statusResult = _computeStatus(
    telemetry,
    skillRecords,
    queryRecords,
    auditEntries,
    doctorResult,
  );
  console.error(
    `[orchestrate] Status: ${statusResult.skills.length} skills, system=${statusResult.system.healthy ? "healthy" : "unhealthy"}`,
  );

  // -------------------------------------------------------------------------
  // Step 3: Select candidates
  // -------------------------------------------------------------------------
  const candidates = selectCandidates(statusResult.skills, options);

  const evolveCandidates = candidates.filter((c) => c.action === "evolve");
  const skipCount = candidates.filter((c) => c.action === "skip").length;
  console.error(
    `[orchestrate] Candidates: ${evolveCandidates.length} to evolve, ${skipCount} skipped`,
  );

  // Log each decision
  for (const c of candidates) {
    console.error(`  ${c.action === "skip" ? "⊘" : "→"} ${c.skill}: ${c.reason}`);
  }

  // -------------------------------------------------------------------------
  // Step 4: Detect agent
  // -------------------------------------------------------------------------
  const agent = _detectAgent();
  if (!agent && evolveCandidates.length > 0) {
    console.error("[orchestrate] WARNING: No agent CLI found in PATH. Evolve will be skipped.");
    for (const c of evolveCandidates) {
      c.action = "skip";
      c.reason = "no agent CLI available";
    }
  }

  // -------------------------------------------------------------------------
  // Step 5: Evolve candidates
  // -------------------------------------------------------------------------
  let deployedCount = 0;

  for (const candidate of evolveCandidates) {
    // Skip if agent detection marked this candidate as skip
    if (candidate.action === "skip") continue;

    const skillPath = _resolveSkillPath(candidate.skill);
    if (!skillPath) {
      candidate.action = "skip";
      candidate.reason = `SKILL.md not found for "${candidate.skill}"`;
      console.error(`  ⊘ ${candidate.skill}: ${candidate.reason}`);
      continue;
    }

    const effectiveDryRun = options.dryRun || !options.autoApprove;
    console.error(
      `[orchestrate] Evolving "${candidate.skill}"${effectiveDryRun ? " (dry-run)" : ""}...`,
    );

    try {
      const evolveResult = await _evolve({
        skillName: candidate.skill,
        skillPath,
        agent: agent as string,
        dryRun: effectiveDryRun,
        confidenceThreshold: 0.6,
        maxIterations: 3,
        gradingResults: _readGradingResults(candidate.skill),
        syncFirst: false, // We already synced
      });

      candidate.evolveResult = evolveResult;

      if (evolveResult.deployed) {
        deployedCount++;
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

  // -------------------------------------------------------------------------
  // Step 6: Watch recently evolved skills
  // -------------------------------------------------------------------------
  // Re-read audit entries to capture any newly-deployed entries from the evolve loop above.
  // evolve() writes audit entries synchronously, so a fresh read is needed.
  const freshAuditEntries = _readAuditEntries();
  const recentlyEvolved = findRecentlyEvolvedSkills(freshAuditEntries, options.recentWindowHours);

  // O(1) lookup for skills already processed as evolve candidates
  const evolvedSkillNames = new Set(
    candidates.filter((c) => c.action === "evolve").map((c) => c.skill),
  );

  let watchedCount = 0;
  for (const skillName of recentlyEvolved) {
    // Skip if already processed in this run as evolve candidate
    if (evolvedSkillNames.has(skillName)) {
      continue;
    }

    // Apply skill filter
    if (options.skillFilter && skillName !== options.skillFilter) continue;

    const skillPath = _resolveSkillPath(skillName);
    if (!skillPath) continue;

    console.error(`[orchestrate] Watching "${skillName}" (recently evolved)...`);

    try {
      const watchResult = await _watch({
        skillName,
        skillPath,
        windowSessions: 20,
        regressionThreshold: 0.1,
        autoRollback: false,
        syncFirst: false,
      });

      candidates.push({
        skill: skillName,
        action: "watch",
        reason: watchResult.alert ?? "stable",
        watchResult,
      });

      watchedCount++;
      console.error(
        `  ${watchResult.alert ? "⚠" : "✓"} ${skillName}: ${watchResult.recommendation}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${skillName}: watch error — ${msg}`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 7: Build summary
  // -------------------------------------------------------------------------
  const result: OrchestrateResult = {
    syncResult,
    statusResult,
    candidates,
    summary: {
      totalSkills: statusResult.skills.length,
      evaluated: evolveCandidates.length,
      evolved: evolveCandidates.filter((c) => c.evolveResult?.deployed).length,
      deployed: deployedCount,
      watched: watchedCount,
      skipped: candidates.filter((c) => c.action === "skip").length,
      dryRun: options.dryRun,
      autoApprove: options.autoApprove,
      elapsedMs: Date.now() - startTime,
    },
  };

  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

export async function cliMain(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: true },
      "auto-approve": { type: "boolean", default: false },
      skill: { type: "string" },
      "max-skills": { type: "string", default: "5" },
      "recent-window": { type: "string", default: "48" },
      "sync-force": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
  });

  if (values.help) {
    console.log(`selftune orchestrate — Autonomous core loop

Runs the full improvement cycle: sync → status → evolve → watch.

Usage:
  selftune orchestrate [options]

Options:
  --dry-run             Preview actions without mutations (default: true)
  --auto-approve        Allow evolve to deploy changes
  --skill <name>        Scope to a single skill
  --max-skills <n>      Cap skills processed per run (default: 5)
  --recent-window <hrs> Hours to look back for watch targets (default: 48)
  --sync-force          Force full rescan during sync
  -h, --help            Show this help message

Safety:
  By default, orchestrate runs in dry-run mode. Evolve proposals are
  validated but not deployed. Pass --auto-approve to enable deployment.
  Even with --auto-approve, each skill must pass validation gates.

Examples:
  selftune orchestrate                          # dry-run preview
  selftune orchestrate --auto-approve           # deploy validated changes
  selftune orchestrate --skill Research         # single skill
  selftune orchestrate --max-skills 3           # limit scope`);
    process.exit(0);
  }

  const maxSkills = Number.parseInt(values["max-skills"] ?? "5", 10);
  if (Number.isNaN(maxSkills) || maxSkills < 1) {
    console.error("[ERROR] --max-skills must be a positive integer");
    process.exit(1);
  }

  const recentWindow = Number.parseInt(values["recent-window"] ?? "48", 10);
  if (Number.isNaN(recentWindow) || recentWindow < 1) {
    console.error("[ERROR] --recent-window must be a positive integer");
    process.exit(1);
  }

  // --auto-approve implies --no-dry-run
  const autoApprove = values["auto-approve"] ?? false;
  const dryRun = autoApprove ? false : (values["dry-run"] ?? true);

  const result = await orchestrate({
    dryRun,
    autoApprove,
    skillFilter: values.skill,
    maxSkills,
    recentWindowHours: recentWindow,
    syncForce: values["sync-force"] ?? false,
  });

  // JSON output: include candidates for machine consumption
  const jsonOutput = {
    ...result.summary,
    decisions: result.candidates.map((c) => ({
      skill: c.skill,
      action: c.action,
      reason: c.reason,
      ...(c.evolveResult
        ? {
            deployed: c.evolveResult.deployed,
            validation: c.evolveResult.validation
              ? {
                  before: c.evolveResult.validation.before_pass_rate,
                  after: c.evolveResult.validation.after_pass_rate,
                  improved: c.evolveResult.validation.improved,
                }
              : null,
          }
        : {}),
      ...(c.watchResult
        ? {
            alert: c.watchResult.alert,
            passRate: c.watchResult.snapshot.pass_rate,
          }
        : {}),
    })),
  };
  console.log(JSON.stringify(jsonOutput, null, 2));

  // Print human-readable decision report to stderr
  console.error(`\n${formatOrchestrateReport(result)}`);

  process.exit(0);
}

if (import.meta.main) {
  cliMain().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[FATAL] ${message}`);
    process.exit(1);
  });
}
