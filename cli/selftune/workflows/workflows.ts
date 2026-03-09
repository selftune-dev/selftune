/**
 * workflows.ts
 *
 * CLI entry point and formatter for multi-skill workflow discovery and management.
 *
 * Exports:
 *  - formatWorkflows()  (pure formatter, deterministic)
 *  - cliMain()          (reads logs, discovers workflows, prints output or saves)
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { SKILL_LOG, TELEMETRY_LOG } from "../constants.js";
import type {
  CodifiedWorkflow,
  SessionTelemetryRecord,
  SkillUsageRecord,
  WorkflowDiscoveryReport,
} from "../types.js";
import { readJsonl } from "../utils/jsonl.js";
import { discoverWorkflows } from "./discover.js";
import { appendWorkflow } from "./skill-md-writer.js";

// ---------------------------------------------------------------------------
// formatWorkflows — pure formatter
// ---------------------------------------------------------------------------

export function formatWorkflows(report: WorkflowDiscoveryReport): string {
  if (report.workflows.length === 0) {
    return "No workflows discovered.";
  }

  const lines: string[] = [];
  lines.push(`Discovered Workflows (from ${report.total_sessions_analyzed} sessions):`);
  lines.push("");

  for (let i = 0; i < report.workflows.length; i++) {
    const wf = report.workflows[i];
    const chain = wf.skills.join(" \u2192 ");
    const synergy = wf.synergy_score.toFixed(2);
    const consistency = Math.round(wf.sequence_consistency * 100);
    const completion = Math.round(wf.completion_rate * 100);

    lines.push(`  ${i + 1}. ${chain}`);
    lines.push(
      `     Occurrences: ${wf.occurrence_count} | Synergy: ${synergy} | Consistency: ${consistency}% | Completion: ${completion}%`,
    );
    if (wf.representative_query) {
      lines.push(`     Common trigger: "${wf.representative_query}"`);
    }
    if (i < report.workflows.length - 1) {
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// cliMain — reads logs, discovers workflows, prints or saves
// ---------------------------------------------------------------------------

export async function cliMain(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: {
      "min-occurrences": { type: "string" },
      window: { type: "string" },
      skill: { type: "string" },
      "skill-path": { type: "string" },
      json: { type: "boolean" },
    },
    strict: true,
    allowPositionals: true,
  });

  const subcommand = positionals[0];
  const minOccurrences = values["min-occurrences"]
    ? Number.parseInt(values["min-occurrences"], 10)
    : undefined;
  const window = values.window ? Number.parseInt(values.window, 10) : undefined;

  // Read telemetry and skill usage logs
  const telemetry = readJsonl<SessionTelemetryRecord>(TELEMETRY_LOG);
  const usage = readJsonl<SkillUsageRecord>(SKILL_LOG);

  // Discover workflows
  const report = discoverWorkflows(telemetry, usage, {
    minOccurrences,
    window,
    skill: values.skill,
  });

  if (subcommand === "save") {
    // Save subcommand: find workflow, append to SKILL.md
    const nameArg = positionals[1];
    if (!nameArg) {
      console.error("[ERROR] Usage: selftune workflows save <name-or-index>");
      process.exit(1);
    }

    // Match by numeric index (1-based) or workflow_id
    let workflow = report.workflows.find((w) => w.workflow_id === nameArg);
    if (!workflow) {
      const idx = Number.parseInt(nameArg, 10);
      if (!Number.isNaN(idx) && idx >= 1 && idx <= report.workflows.length) {
        workflow = report.workflows[idx - 1];
      }
    }

    if (!workflow) {
      console.error(`[ERROR] No workflow found matching "${nameArg}".`);
      console.error(
        "Run 'selftune workflows' to see discovered workflows and their indices.",
      );
      process.exit(1);
    }

    // Determine SKILL.md path
    let skillPath = values["skill-path"];
    if (!skillPath) {
      // Use the first skill's skill_path from usage records
      const firstSkill = workflow.skills[0];
      const usageRecord = usage.find((u) => u.skill_name === firstSkill);
      if (usageRecord) {
        skillPath = usageRecord.skill_path;
      }
    }

    if (!skillPath || !existsSync(skillPath)) {
      console.error(
        `[ERROR] Could not determine SKILL.md path. Use --skill-path to specify.`,
      );
      process.exit(1);
    }

    // Build CodifiedWorkflow
    const codified: CodifiedWorkflow = {
      name: workflow.skills.join("-"),
      skills: workflow.skills,
      description: workflow.representative_query || undefined,
      source: "discovered",
      discovered_from: {
        workflow_id: workflow.workflow_id,
        occurrence_count: workflow.occurrence_count,
        synergy_score: workflow.synergy_score,
      },
    };

    // Read, append, write
    const content = readFileSync(skillPath, "utf-8");
    const updated = appendWorkflow(content, codified);

    if (updated === content) {
      console.log(`Workflow "${codified.name}" already exists in ${skillPath}`);
    } else {
      writeFileSync(skillPath, updated, "utf-8");
      console.log(`Saved workflow "${codified.name}" to ${skillPath}`);
    }

    return;
  }

  // Default: discover and display
  if (values.json || !process.stdout.isTTY) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatWorkflows(report));
  }
}
