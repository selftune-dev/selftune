#!/usr/bin/env bun
/**
 * grade-session.ts
 *
 * Rubric-based grader for Claude Code skill sessions.
 * Migrated from grade_session.py.
 *
 * Two modes:
 *   1. --use-agent  (default when no ANTHROPIC_API_KEY) — invokes installed agent CLI
 *   2. --use-api    (default when ANTHROPIC_API_KEY set) — calls Anthropic API directly
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

import { AGENT_CANDIDATES, API_URL, MODEL, SKILL_LOG, TELEMETRY_LOG } from "../constants.js";
import type {
  EvalFeedback,
  ExecutionMetrics,
  GraderOutput,
  GradingClaim,
  GradingExpectation,
  GradingResult,
  GradingSummary,
  SessionTelemetryRecord,
} from "../types.js";
import { readJsonl } from "../utils/jsonl.js";
import { readExcerpt } from "../utils/transcript.js";

// ---------------------------------------------------------------------------
// Grader system prompt
// ---------------------------------------------------------------------------

export const GRADER_SYSTEM = `You are a rigorous skill session evaluator. You receive:
1. Expectations to grade (things that should be true)
2. Process telemetry: tool calls, bash commands, skills triggered, errors
3. A transcript excerpt showing what happened

Grade each expectation and output ONLY valid JSON matching this schema:
{
  "expectations": [
    {"text": "...", "passed": true/false, "evidence": "specific quote or metric"}
  ],
  "summary": {"passed": N, "failed": N, "total": N, "pass_rate": 0.0},
  "claims": [
    {"claim": "...", "type": "factual|process|quality", "verified": true/false, "evidence": "..."}
  ],
  "eval_feedback": {
    "suggestions": [{"assertion": "...", "reason": "..."}],
    "overall": "one sentence"
  }
}

Rules:
- PASS only when there is clear, specific evidence — not assumptions
- FAIL when evidence is absent or contradictory
- Cite exact quotes or specific metric values
- Extract 2-4 implicit claims from the transcript and verify them
- Suggest eval improvements only for clear gaps`;

// ---------------------------------------------------------------------------
// Agent detection
// ---------------------------------------------------------------------------

export function detectAgent(): string | null {
  for (const agent of AGENT_CANDIDATES) {
    if (Bun.which(agent)) return agent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Markdown fence stripping
// ---------------------------------------------------------------------------

export function stripMarkdownFences(raw: string): string {
  let text = raw.trim();

  // Handle fences that may appear after preamble text
  const fenceStart = text.indexOf("```");
  if (fenceStart >= 0) {
    // Jump to the fence
    let inner = text.slice(fenceStart);
    // Remove opening fence line (```json or ```)
    const newlineIdx = inner.indexOf("\n");
    inner = newlineIdx >= 0 ? inner.slice(newlineIdx + 1) : inner.slice(3);
    // Remove closing fence
    if (inner.endsWith("```")) {
      inner = inner.slice(0, -3);
    }
    text = inner.trim();
  }

  // Find first { in case there's preamble text
  const braceIdx = text.indexOf("{");
  if (braceIdx > 0) {
    text = text.slice(braceIdx);
  }

  return text;
}

// ---------------------------------------------------------------------------
// Data lookup helpers
// ---------------------------------------------------------------------------

export function findSession(
  records: SessionTelemetryRecord[],
  sessionId: string,
): SessionTelemetryRecord | null {
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].session_id === sessionId) return records[i];
  }
  return null;
}

export function latestSessionForSkill(
  telemetry: SessionTelemetryRecord[],
  skillName: string,
): SessionTelemetryRecord | null {
  for (let i = telemetry.length - 1; i >= 0; i--) {
    if (telemetry[i].skills_triggered?.includes(skillName)) return telemetry[i];
  }
  return null;
}

export function loadExpectationsFromEvalsJson(evalsJsonPath: string, evalId: number): string[] {
  const data = JSON.parse(readFileSync(evalsJsonPath, "utf-8"));
  for (const ev of data.evals ?? []) {
    if (ev.id === evalId) return ev.expectations ?? [];
  }
  throw new Error(`Eval ID ${evalId} not found in ${evalsJsonPath}`);
}

// ---------------------------------------------------------------------------
// Execution metrics
// ---------------------------------------------------------------------------

export function buildExecutionMetrics(telemetry: SessionTelemetryRecord): ExecutionMetrics {
  return {
    tool_calls: telemetry.tool_calls ?? {},
    total_tool_calls: telemetry.total_tool_calls ?? 0,
    total_steps: telemetry.assistant_turns ?? 0,
    bash_commands_run: (telemetry.bash_commands ?? []).length,
    errors_encountered: telemetry.errors_encountered ?? 0,
    skills_triggered: telemetry.skills_triggered ?? [],
    transcript_chars: telemetry.transcript_chars ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

export function buildGradingPrompt(
  expectations: string[],
  telemetry: SessionTelemetryRecord,
  transcriptExcerpt: string,
  skillName: string,
): string {
  const toolSummary = JSON.stringify(telemetry.tool_calls ?? {}, null, 2);
  const commands = telemetry.bash_commands ?? [];
  const cmdSummary =
    commands
      .slice(0, 20)
      .map((c) => `  $ ${c.slice(0, 120)}`)
      .join("\n") || "  (none)";

  const expectationsList = expectations.map((e, i) => `${i + 1}. ${e}`).join("\n");

  return `Skill: ${skillName}

=== PROCESS TELEMETRY ===
Skills triggered: ${JSON.stringify(telemetry.skills_triggered ?? [])}
Assistant turns: ${telemetry.assistant_turns ?? "?"}
Errors: ${telemetry.errors_encountered ?? "?"}
Total tool calls: ${telemetry.total_tool_calls ?? "?"}

Tool breakdown:
${toolSummary}

Bash commands:
${cmdSummary}

=== TRANSCRIPT EXCERPT ===
${transcriptExcerpt}

=== EXPECTATIONS ===
${expectationsList}

Grade each expectation. Output JSON only.`;
}

// ---------------------------------------------------------------------------
// Grading via agent subprocess
// ---------------------------------------------------------------------------

export async function gradeViaAgent(prompt: string, agent: string): Promise<GraderOutput> {
  // Write prompt to temp file to avoid shell quoting issues
  const promptFile = join(tmpdir(), `selftune-grade-${Date.now()}.txt`);
  writeFileSync(promptFile, `${GRADER_SYSTEM}\n\n${prompt}`, "utf-8");

  try {
    const promptContent = readFileSync(promptFile, "utf-8");
    let cmd: string[];

    if (agent === "claude") {
      cmd = ["claude", "-p", promptContent];
    } else if (agent === "codex") {
      cmd = ["codex", "exec", "--skip-git-repo-check", promptContent];
    } else if (agent === "opencode") {
      cmd = ["opencode", "-p", promptContent, "-f", "text", "-q"];
    } else {
      throw new Error(`Unknown agent: ${agent}`);
    }

    const proc = Bun.spawn(cmd, {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, CLAUDECODE: "" },
    });

    // 120s timeout
    const timeout = setTimeout(() => proc.kill(), 120_000);
    const exitCode = await proc.exited;
    clearTimeout(timeout);

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(
        `Agent '${agent}' exited with code ${exitCode}.\nstderr: ${stderr.slice(0, 500)}`,
      );
    }

    const raw = await new Response(proc.stdout).text();
    const cleaned = stripMarkdownFences(raw);
    return JSON.parse(cleaned) as GraderOutput;
  } finally {
    try {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(promptFile);
    } catch {
      // ignore cleanup errors
    }
  }
}

// ---------------------------------------------------------------------------
// Grading via direct Anthropic API
// ---------------------------------------------------------------------------

export async function gradeViaApi(prompt: string): Promise<GraderOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Use --use-agent to grade via your " +
        "installed Claude Code / Codex / OpenCode subscription instead.",
    );
  }

  const payload = {
    model: MODEL,
    max_tokens: 2000,
    system: GRADER_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  };

  const resp = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`API error ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  let raw = "";
  for (const block of data.content ?? []) {
    if (block.type === "text") raw += block.text ?? "";
  }

  const cleaned = stripMarkdownFences(raw);
  return JSON.parse(cleaned) as GraderOutput;
}

// ---------------------------------------------------------------------------
// Result assembly
// ---------------------------------------------------------------------------

export function assembleResult(
  graderOutput: GraderOutput,
  telemetry: SessionTelemetryRecord,
  sessionId: string,
  skillName: string,
  transcriptPath: string,
): GradingResult {
  return {
    session_id: sessionId,
    skill_name: skillName,
    transcript_path: transcriptPath,
    graded_at: new Date().toISOString(),
    expectations: graderOutput.expectations ?? [],
    summary: graderOutput.summary ?? { passed: 0, failed: 0, total: 0, pass_rate: 0 },
    execution_metrics: buildExecutionMetrics(telemetry),
    claims: graderOutput.claims ?? [],
    eval_feedback: graderOutput.eval_feedback ?? { suggestions: [], overall: "" },
  };
}

// ---------------------------------------------------------------------------
// Summary printer
// ---------------------------------------------------------------------------

function printSummary(result: GradingResult): void {
  const { summary } = result;
  const rate = summary.pass_rate ?? 0;
  console.log(`\nResults: ${summary.passed}/${summary.total} passed (${Math.round(rate * 100)}%)`);
  for (const exp of result.expectations) {
    const icon = exp.passed ? "\u2713" : "\u2717";
    console.log(`  ${icon} ${exp.text.slice(0, 70)}`);
    if (!exp.passed) {
      console.log(`      -> ${exp.evidence.slice(0, 100)}`);
    }
  }

  const feedback = result.eval_feedback;
  if (feedback.suggestions?.length) {
    console.log(`\nEval feedback: ${feedback.overall}`);
    for (const s of feedback.suggestions) {
      console.log(`  * ${s.reason.slice(0, 100)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      skill: { type: "string" },
      expectations: { type: "string", multiple: true },
      "evals-json": { type: "string" },
      "eval-id": { type: "string" },
      "session-id": { type: "string" },
      transcript: { type: "string" },
      "telemetry-log": { type: "string", default: TELEMETRY_LOG },
      output: { type: "string", default: "grading.json" },
      "use-agent": { type: "boolean", default: false },
      "use-api": { type: "boolean", default: false },
      agent: { type: "string" },
      "show-transcript": { type: "boolean", default: false },
    },
    strict: true,
  });

  const skill = values.skill;
  if (!skill) {
    console.error("[ERROR] --skill is required");
    process.exit(1);
  }

  // --- Determine mode ---
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);
  let mode: "agent" | "api";
  let agent: string | null = null;

  if (values["use-api"]) {
    mode = "api";
  } else if (values["use-agent"]) {
    mode = "agent";
  } else {
    const availableAgent = detectAgent();
    if (availableAgent) {
      mode = "agent";
    } else if (hasApiKey) {
      mode = "api";
    } else {
      console.error(
        "[ERROR] No agent CLI (claude/codex/opencode) found in PATH " +
          "and ANTHROPIC_API_KEY not set.\n" +
          "Install Claude Code, Codex, or OpenCode, or set ANTHROPIC_API_KEY.",
      );
      process.exit(1);
    }
  }

  if (mode === "agent") {
    const validAgents = ["claude", "codex", "opencode"];
    if (values.agent && validAgents.includes(values.agent)) {
      agent = values.agent;
    } else {
      agent = detectAgent();
    }
    if (!agent) {
      console.error(
        "[ERROR] --use-agent specified but no agent found in PATH.\n" +
          "Install claude, codex, or opencode, or use --use-api instead.",
      );
      process.exit(1);
    }
    console.error(`[INFO] Grading via agent: ${agent}`);
  } else {
    console.error("[INFO] Grading via direct Anthropic API");
  }

  // --- Resolve expectations ---
  let expectations: string[] = [];
  if (values["evals-json"] && values["eval-id"] != null) {
    expectations = loadExpectationsFromEvalsJson(values["evals-json"], Number(values["eval-id"]));
  } else if (values.expectations?.length) {
    expectations = values.expectations;
  } else {
    console.error("[ERROR] Provide --expectations or --evals-json + --eval-id");
    process.exit(1);
  }

  // --- Resolve session ---
  let telemetry = {} as SessionTelemetryRecord;
  let transcriptPath = "";
  let sessionId = "unknown";

  const telemetryLog = values["telemetry-log"] ?? TELEMETRY_LOG;
  const telRecords = readJsonl<SessionTelemetryRecord>(telemetryLog);

  if (values.transcript) {
    transcriptPath = values.transcript;
    for (let i = telRecords.length - 1; i >= 0; i--) {
      if (telRecords[i].transcript_path === transcriptPath) {
        telemetry = telRecords[i];
        sessionId = telRecords[i].session_id ?? "unknown";
        break;
      }
    }
  } else if (values["session-id"]) {
    sessionId = values["session-id"];
    telemetry = findSession(telRecords, sessionId) ?? ({} as SessionTelemetryRecord);
    transcriptPath = telemetry.transcript_path ?? "";
  } else {
    telemetry = latestSessionForSkill(telRecords, skill) ?? ({} as SessionTelemetryRecord);
    if (telemetry.session_id) {
      sessionId = telemetry.session_id;
      transcriptPath = telemetry.transcript_path ?? "";
      console.error(`[INFO] Grading most recent '${skill}' session: ${sessionId}`);
    } else {
      console.error(`[WARN] No telemetry for skill '${skill}'. Is session_stop_hook installed?`);
    }
  }

  const transcriptExcerpt = transcriptPath ? readExcerpt(transcriptPath) : "(no transcript)";

  if (values["show-transcript"]) {
    console.log("=== TRANSCRIPT EXCERPT ===");
    console.log(transcriptExcerpt);
    console.log("==========================\n");
  }

  // --- Build prompt and grade ---
  const prompt = buildGradingPrompt(expectations, telemetry, transcriptExcerpt, skill);

  console.error(`Grading ${expectations.length} expectations for skill '${skill}'...`);

  let graderOutput: GraderOutput;
  try {
    if (mode === "agent") {
      graderOutput = await gradeViaAgent(prompt, agent as string);
    } else {
      graderOutput = await gradeViaApi(prompt);
    }
  } catch (e) {
    console.error(`[ERROR] Grading failed: ${e}`);
    process.exit(1);
  }

  const result = assembleResult(graderOutput, telemetry, sessionId, skill, transcriptPath);

  const outputPath = values.output ?? "grading.json";
  const outputDir = dirname(outputPath);
  if (outputDir !== ".") {
    mkdirSync(outputDir, { recursive: true });
  }
  writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");

  printSummary(result);
  console.log(`\nWrote ${outputPath}`);
}

// Guard: only run when invoked directly
const isMain =
  import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("grade-session.ts");

if (isMain) {
  main().catch((err) => {
    console.error(`[FATAL] ${err}`);
    process.exit(1);
  });
}
