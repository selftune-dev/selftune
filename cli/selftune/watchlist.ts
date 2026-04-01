import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { SELFTUNE_CONFIG_DIR, WATCHED_SKILLS_PATH } from "./constants.js";

interface WatchlistPayload {
  version: 1;
  skills: string[];
}

function normalizeSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const skill of skills) {
    const trimmed = skill.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

export function loadWatchedSkills(): string[] {
  try {
    if (!existsSync(WATCHED_SKILLS_PATH)) return [];
    const parsed = JSON.parse(
      readFileSync(WATCHED_SKILLS_PATH, "utf-8"),
    ) as Partial<WatchlistPayload>;
    return Array.isArray(parsed.skills)
      ? normalizeSkills(parsed.skills.filter((skill): skill is string => typeof skill === "string"))
      : [];
  } catch {
    return [];
  }
}

export function saveWatchedSkills(skills: string[]): string[] {
  const normalized = normalizeSkills(skills);
  mkdirSync(SELFTUNE_CONFIG_DIR, { recursive: true });
  writeFileSync(
    WATCHED_SKILLS_PATH,
    JSON.stringify({ version: 1, skills: normalized }, null, 2),
    "utf-8",
  );
  return normalized;
}
