/**
 * description-quality.ts
 *
 * Pure, deterministic scoring function that evaluates the quality of a skill
 * description for routing accuracy. No LLM calls — heuristic-only.
 *
 * Inspired by OpenAI's finding that "writing better skill descriptions improved
 * routing accuracy more than any change to the underlying skill logic itself."
 */

import type { DescriptionQualityScore } from "../types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Optimal description length range (characters). */
const MIN_LENGTH = 40;
const MAX_LENGTH = 500;
const IDEAL_MIN = 80;
const IDEAL_MAX = 300;

/** Words that indicate trigger context — the description says *when* the skill fires. */
const TRIGGER_CONTEXT_WORDS = [
  "when",
  "if",
  "after",
  "before",
  "during",
  "while",
  "upon",
  "whenever",
  "use when",
  "trigger",
  "activate",
];

/** Vague words that weaken routing precision. */
const VAGUE_WORDS = [
  "various",
  "general",
  "misc",
  "miscellaneous",
  "stuff",
  "things",
  "etc",
  "and more",
  "and so on",
  "other",
  "multiple",
  "several",
  "many",
  "some",
  "certain",
  "related",
];

/** Common filler phrases that add no routing signal. */
const FILLER_PHRASES = [
  "this skill",
  "a tool for",
  "a tool that",
  "helps with",
  "is used for",
  "can be used",
  "is designed to",
];

// ---------------------------------------------------------------------------
// Criterion scorers
// ---------------------------------------------------------------------------

/** Score description length: 1.0 for ideal range, graded falloff outside. */
export function scoreLengthCriterion(description: string): number {
  const len = description.length;
  if (len < MIN_LENGTH) return len / MIN_LENGTH; // 0 → MIN_LENGTH = 0 → 1
  if (len >= IDEAL_MIN && len <= IDEAL_MAX) return 1.0;
  if (len < IDEAL_MIN) return 0.7 + 0.3 * ((len - MIN_LENGTH) / (IDEAL_MIN - MIN_LENGTH));
  if (len <= MAX_LENGTH) return 0.7 + 0.3 * ((MAX_LENGTH - len) / (MAX_LENGTH - IDEAL_MAX));
  return Math.max(0.3, 0.7 - 0.4 * ((len - MAX_LENGTH) / MAX_LENGTH));
}

/** Score presence of trigger context words (when/if/before/after etc). */
export function scoreTriggerContextCriterion(description: string): number {
  const lower = description.toLowerCase();
  // Use word boundary matching to avoid false positives (e.g. "verification" matching "if")
  const matches = TRIGGER_CONTEXT_WORDS.filter((w) => {
    const regex = new RegExp(`\\b${w.replace(/\s+/g, "\\s+")}\\b`, "i");
    return regex.test(lower);
  });
  if (matches.length === 0) return 0.0;
  if (matches.length === 1) return 0.7;
  return Math.min(1.0, 0.7 + 0.15 * (matches.length - 1));
}

/** Score absence of vague words (lower is worse). */
export function scoreVaguenessCriterion(description: string): number {
  const lower = description.toLowerCase();
  const matches = VAGUE_WORDS.filter((w) => {
    const regex = new RegExp(`\\b${w.replace(/\s+/g, "\\s+")}\\b`, "i");
    return regex.test(lower);
  });
  if (matches.length === 0) return 1.0;
  if (matches.length === 1) return 0.6;
  return Math.max(0.1, 0.6 - 0.15 * (matches.length - 1));
}

/** Score whether description specifies at least one concrete action or domain. */
export function scoreSpecificityCriterion(description: string): number {
  const lower = description.toLowerCase();

  // Check for action verbs (signals concrete behavior)
  const actionVerbs = [
    "run",
    "execute",
    "analyze",
    "generate",
    "create",
    "deploy",
    "validate",
    "check",
    "build",
    "test",
    "scan",
    "extract",
    "transform",
    "monitor",
    "grade",
    "evolve",
    "sync",
    "watch",
    "review",
    "audit",
    "parse",
    "format",
    "search",
    "fetch",
    "publish",
    "install",
    "configure",
    "diagnose",
    "debug",
    "fix",
    "optimize",
    "measure",
  ];
  const hasAction = actionVerbs.some((v) => lower.includes(v));

  // Check for filler-heavy descriptions
  const fillerCount = FILLER_PHRASES.filter((f) => lower.includes(f)).length;
  const words = description.split(/\s+/).length;
  const fillerRatio = fillerCount > 0 ? fillerCount / Math.max(1, words / 10) : 0;

  if (!hasAction) return 0.2;
  return Math.max(0.3, 1.0 - fillerRatio * 0.3);
}

/** Score whether description is not just the skill name restated. */
export function scoreNotJustNameCriterion(description: string, skillName?: string): number {
  if (!skillName) return 1.0;
  const descNorm = description
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "");
  const nameNorm = skillName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "");
  const nameFromKebab = skillName.replace(/[-_]/g, " ").toLowerCase().trim();

  if (descNorm === nameNorm || descNorm === nameFromKebab) return 0.0;
  if (descNorm.length < nameNorm.length + 10) return 0.3;
  return 1.0;
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

/** Criterion weights — trigger context is weighted highest per OpenAI's finding. */
const WEIGHTS = {
  length: 0.15,
  trigger_context: 0.3,
  vagueness: 0.2,
  specificity: 0.2,
  not_just_name: 0.15,
};

/**
 * Score a skill description on heuristic quality criteria.
 * Returns a 0.0-1.0 composite score with per-criterion breakdown.
 * Pure function — no I/O, no LLM calls.
 */
export function scoreDescription(description: string, skillName?: string): DescriptionQualityScore {
  const criteria = {
    length: scoreLengthCriterion(description),
    trigger_context: scoreTriggerContextCriterion(description),
    vagueness: scoreVaguenessCriterion(description),
    specificity: scoreSpecificityCriterion(description),
    not_just_name: scoreNotJustNameCriterion(description, skillName),
  };

  const composite =
    criteria.length * WEIGHTS.length +
    criteria.trigger_context * WEIGHTS.trigger_context +
    criteria.vagueness * WEIGHTS.vagueness +
    criteria.specificity * WEIGHTS.specificity +
    criteria.not_just_name * WEIGHTS.not_just_name;

  return {
    composite: +composite.toFixed(3),
    criteria,
  };
}
