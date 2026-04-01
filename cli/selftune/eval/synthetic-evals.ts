/**
 * synthetic-evals.ts
 *
 * Generates eval queries from a SKILL.md using an LLM, without requiring
 * real session logs. Solves the cold-start problem for new skills that
 * have no telemetry data yet.
 */

import { readFileSync } from "node:fs";

import type { EvalEntry, InvocationType } from "../types.js";
import { callLlm, stripMarkdownFences } from "../utils/llm-call.js";
import { findInstalledSkillNames } from "../utils/skill-discovery.js";
import { classifyInvocation } from "./hooks-to-evals.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyntheticEvalOptions {
  maxPositives?: number;
  maxNegatives?: number;
  modelFlag?: string;
}

interface RawSyntheticEntry {
  query: string;
  should_trigger: boolean;
  invocation_type?: string;
}

interface SyntheticPromptRealExamples {
  positive: string[];
  negative: string[];
}

function getSyntheticSkillSearchDirs(): string[] {
  const cwd = process.cwd();
  const homeDir = process.env.HOME ?? "";
  const codexHome = process.env.CODEX_HOME ?? `${homeDir}/.codex`;
  return [
    `${cwd}/.agents/skills`,
    `${cwd}/.claude/skills`,
    `${homeDir}/.agents/skills`,
    `${homeDir}/.claude/skills`,
    `${codexHome}/skills`,
  ];
}

function inferSiblingSkills(
  skillName: string,
  searchDirs: string[] = getSyntheticSkillSearchDirs(),
): string[] {
  const normalized = skillName.trim().toLowerCase();
  if (!normalized) return [];

  const familyPrefix = normalized.includes("-") ? normalized.split("-")[0] : "";
  const installedNames = [...findInstalledSkillNames(searchDirs)];

  const sameFamily = installedNames
    .filter((name) => name.toLowerCase() !== normalized)
    .filter((name) => familyPrefix && name.toLowerCase().startsWith(`${familyPrefix}-`))
    .sort((a, b) => a.localeCompare(b));

  if (sameFamily.length >= 5) return sameFamily.slice(0, 5);

  const adjacent = installedNames
    .filter((name) => name.toLowerCase() !== normalized)
    .filter((name) => !sameFamily.includes(name))
    .sort((a, b) => a.localeCompare(b));

  return [...sameFamily, ...adjacent].slice(0, 5);
}

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

export function buildSyntheticPrompt(
  skillContent: string,
  skillName: string,
  maxPositives: number,
  maxNegatives: number,
  realExamples?: SyntheticPromptRealExamples,
  siblingSkills: string[] = [],
): { system: string; user: string } {
  const explicitCount = Math.max(1, Math.round(maxPositives * 0.2));
  const contextualCount = Math.max(1, Math.round(maxPositives * 0.4));
  const implicitCount = Math.max(1, maxPositives - explicitCount - contextualCount);

  const siblingNegativeCount =
    siblingSkills.length > 0 ? Math.max(1, Math.round(maxNegatives * 0.4)) : 0;
  const adjacentNegativeCount = Math.max(
    1,
    maxNegatives - siblingNegativeCount - Math.max(1, Math.round(maxNegatives * 0.2)),
  );
  const unrelatedNegativeCount = Math.max(
    1,
    maxNegatives - siblingNegativeCount - adjacentNegativeCount,
  );

  const system = `You are generating test queries for a coding agent skill. Given the skill description below, generate realistic user queries.

Your job is to create a SMALL, TARGETED benchmark for cold-start routing quality.

For POSITIVE queries (should trigger this skill):
- Generate a balanced mix of:
  - Explicit: directly names the skill or uses $${skillName} syntax
  - Implicit: describes the task without naming the skill
  - Contextual: realistic natural language with domain context, proper nouns, filenames, or setup noise
- Avoid merely paraphrasing bullet points from the skill
- Prefer realistic user phrasing over polished product copy
- Include at least a few prompts that test the edge of the skill's scope, not just the obvious center

For NEGATIVE queries (should NOT trigger this skill):
- Include hard negative controls:
  - sibling-skill confusion cases
  - topically adjacent but wrong-intent cases
  - clearly unrelated cases
- Make the hard negatives plausible, not cartoonishly unrelated
- If a query belongs to another installed skill, make that obvious from the task itself

Output as JSON array with no surrounding text:
[{"query": "...", "should_trigger": true, "invocation_type": "explicit|implicit|contextual|negative"}]`;

  let user = `Skill name: ${skillName}

Skill content:
${skillContent}

Generate exactly ${maxPositives} positive queries (should_trigger: true) and ${maxNegatives} negative queries (should_trigger: false).

Required positive mix:
- ${explicitCount} explicit
- ${implicitCount} implicit
- ${contextualCount} contextual

Required negative mix:
- ${siblingNegativeCount} sibling-skill confusion cases
- ${adjacentNegativeCount} adjacent but wrong-intent cases
- ${unrelatedNegativeCount} clearly unrelated cases

Return ONLY the JSON array.`;

  if (realExamples && (realExamples.positive.length > 0 || realExamples.negative.length > 0)) {
    const parts: string[] = ["\n\nReal user queries for style and phrasing reference:"];
    if (realExamples.positive.length > 0) {
      parts.push("Queries that triggered this skill:");
      parts.push(...realExamples.positive.map((q) => `  - "${q}"`));
    }
    if (realExamples.negative.length > 0) {
      parts.push("Queries that did NOT trigger (general queries):");
      parts.push(...realExamples.negative.map((q) => `  - "${q}"`));
    }
    parts.push("\nGenerate queries that match this natural phrasing style.");
    user += parts.join("\n");
  }

  if (siblingSkills.length > 0) {
    user += `\n\nNearby installed skills to use for boundary-setting hard negatives:\n${siblingSkills
      .map((skill) => `- ${skill}`)
      .join(
        "\n",
      )}\n\nAt least ${siblingNegativeCount} negative queries should clearly belong to one of these sibling skills instead of ${skillName}.`;
  }

  return { system, user };
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

export function parseSyntheticResponse(raw: string, skillName: string): EvalEntry[] {
  let text = raw.trim();

  // Strip markdown fences manually for array-first JSON
  // (stripMarkdownFences slices to first '{' which breaks '[' arrays)
  const fenceMatch = text.match(/^```\w*\n/);
  if (fenceMatch) {
    text = text.slice(fenceMatch[0].length);
    const closingIdx = text.lastIndexOf("```");
    if (closingIdx >= 0) {
      text = text.slice(0, closingIdx);
    }
    text = text.trim();
  }

  // Find the JSON array start
  const bracketIdx = text.indexOf("[");
  if (bracketIdx < 0) {
    // No array found — try stripMarkdownFences as fallback for edge cases
    const cleaned = stripMarkdownFences(raw);
    const retryIdx = cleaned.indexOf("[");
    if (retryIdx >= 0) {
      text = cleaned.slice(retryIdx);
    } else {
      throw new Error(`Failed to parse synthetic eval response as JSON: ${text.slice(0, 200)}`);
    }
  } else {
    text = text.slice(bracketIdx);
  }

  // Trim trailing content after the array closes
  const lastBracket = text.lastIndexOf("]");
  if (lastBracket >= 0) {
    text = text.slice(0, lastBracket + 1);
  }

  const jsonText = text;

  let entries: RawSyntheticEntry[];
  try {
    entries = JSON.parse(jsonText);
  } catch {
    throw new Error(`Failed to parse synthetic eval response as JSON: ${jsonText.slice(0, 200)}`);
  }

  if (!Array.isArray(entries)) {
    throw new Error("Synthetic eval response is not a JSON array");
  }

  const result: EvalEntry[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry.query !== "string" || typeof entry.should_trigger !== "boolean") {
      continue;
    }

    const query = entry.query.trim();
    if (!query) continue;

    // For positives, use classifyInvocation to verify/override the LLM's type
    let invocationType: InvocationType;
    if (entry.should_trigger) {
      invocationType = classifyInvocation(query, skillName);
    } else {
      invocationType = "negative";
    }

    result.push({
      query,
      should_trigger: entry.should_trigger,
      invocation_type: invocationType,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function generateSyntheticEvals(
  skillPath: string,
  skillName: string,
  agent: string,
  options: SyntheticEvalOptions = {},
): Promise<EvalEntry[]> {
  const maxPositives = options.maxPositives ?? 15;
  const maxNegatives = options.maxNegatives ?? 10;

  const skillContent = readFileSync(skillPath, "utf-8");
  const siblingSkills = inferSiblingSkills(skillName);

  // Load real query examples from the database for few-shot style guidance.
  // Uses dynamic imports since SQLite may not be available in all contexts.
  let realExamples: { positive: string[]; negative: string[] } | undefined;
  try {
    const { getDb } = await import("../localdb/db.js");
    const { querySkillUsageRecords, queryQueryLog } = await import("../localdb/queries.js");
    const { isHighConfidencePositiveSkillRecord } =
      await import("../utils/skill-usage-confidence.js");

    const db = getDb();

    // Positives: high-confidence triggered records for this skill
    const skillRecords = querySkillUsageRecords(db);
    const positive = skillRecords
      .filter((r) => isHighConfidencePositiveSkillRecord(r, skillName))
      .map((r) => r.query)
      .filter((q): q is string => typeof q === "string" && q.length > 0)
      .slice(0, 5);

    // Negatives: from all_queries, excluding known positives
    const posSet = new Set(positive.map((q: string) => q.toLowerCase()));
    const allQueries = queryQueryLog(db);
    const negative = allQueries
      .map((r) => r.query)
      .filter(
        (q): q is string => typeof q === "string" && q.length > 0 && !posSet.has(q.toLowerCase()),
      )
      .slice(0, 5);

    if (positive.length > 0) {
      realExamples = { positive, negative };
    }
  } catch {
    // fail-open: synthetic gen works without real examples
  }

  const { system, user } = buildSyntheticPrompt(
    skillContent,
    skillName,
    maxPositives,
    maxNegatives,
    realExamples,
    siblingSkills,
  );

  const raw = await callLlm(system, user, agent, options.modelFlag);
  return parseSyntheticResponse(raw, skillName);
}
