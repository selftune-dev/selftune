/**
 * deploy-proposal.ts
 *
 * Deploys a validated evolution proposal by updating SKILL.md locally:
 * creating a backup, replacing the description, and building a commit message.
 *
 * Evolution is a local personalization — the evolved description reflects how
 * *this user* works, not a change the skill creator should adopt. A future
 * upstream feedback channel (anonymized patterns, not raw descriptions) may
 * let end-users send useful signal back to skill creators, but that's a
 * separate concern from deploy. See TD-019 in tech-debt-tracker.md.
 */

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

import type { EvolutionProposal, SkillSections } from "../types.js";
import type { ValidationResult } from "./validate-proposal.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeployOptions {
  proposal: EvolutionProposal;
  validation: ValidationResult;
  skillPath: string;
}

export interface DeployResult {
  skillMdUpdated: boolean;
  backupPath: string | null;
  commitMessage: string;
}

// ---------------------------------------------------------------------------
// SKILL.md reading
// ---------------------------------------------------------------------------

/** Read the contents of a SKILL.md file. Throws if the file does not exist. */
export function readSkillMd(skillPath: string): string {
  if (!existsSync(skillPath)) {
    throw new Error(`SKILL.md not found at ${skillPath}`);
  }
  return readFileSync(skillPath, "utf-8");
}

// ---------------------------------------------------------------------------
// Description replacement
// ---------------------------------------------------------------------------

/**
 * Replace the description section of a SKILL.md file.
 *
 * The description is defined as the content between the first `#` heading
 * and the first `##` heading. If no `##` heading exists, the entire body
 * after the first heading is replaced.
 */
export function replaceDescription(currentContent: string, newDescription: string): string {
  const lines = currentContent.split("\n");

  // Find the first # heading line
  let headingIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("# ") && !lines[i].startsWith("## ")) {
      headingIndex = i;
      break;
    }
  }

  // If no heading found, just prepend the description
  if (headingIndex === -1) {
    return `${newDescription}\n${currentContent}`;
  }

  // Find the first ## heading after the main heading
  let subHeadingIndex = -1;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      subHeadingIndex = i;
      break;
    }
  }

  // Build the new content, preserving any preamble before the first heading
  const preamble = headingIndex > 0 ? `${lines.slice(0, headingIndex).join("\n")}\n` : "";
  const headingLine = lines[headingIndex];
  const descriptionBlock = newDescription.length > 0 ? `\n${newDescription}\n` : "\n";

  if (subHeadingIndex === -1) {
    // No sub-heading: preamble + heading + new description + trailing newline
    return `${preamble}${headingLine}\n${descriptionBlock}\n`;
  }

  // Preamble + heading + description + everything from the first ## onward
  const afterSubHeading = lines.slice(subHeadingIndex).join("\n");
  return `${preamble}${headingLine}\n${descriptionBlock}\n${afterSubHeading}`;
}

// ---------------------------------------------------------------------------
// Structured SKILL.md parsing
// ---------------------------------------------------------------------------

/**
 * Parse a SKILL.md file into named sections.
 *
 * Splits the content into:
 *   - frontmatter: YAML frontmatter block (if present, including delimiters)
 *   - title: the first `# Heading` line
 *   - description: content between the title and the first `## ` heading
 *   - sections: map of `## Name` -> content (up to next `##` or EOF)
 */
export function parseSkillSections(content: string): SkillSections {
  const lines = content.split("\n");
  let idx = 0;

  // --- frontmatter ---
  let frontmatter = "";
  if (lines[0]?.trim() === "---") {
    const endIdx = lines.indexOf("---", 1);
    if (endIdx > 0) {
      frontmatter = lines.slice(0, endIdx + 1).join("\n");
      idx = endIdx + 1;
      // skip blank line after frontmatter
      if (idx < lines.length && lines[idx].trim() === "") idx++;
    }
  }

  // --- title ---
  let title = "";
  while (idx < lines.length) {
    if (lines[idx].startsWith("# ") && !lines[idx].startsWith("## ")) {
      title = lines[idx];
      idx++;
      break;
    }
    idx++;
  }

  // --- description (between title and first ## heading) ---
  const descLines: string[] = [];
  while (idx < lines.length && !lines[idx].startsWith("## ")) {
    descLines.push(lines[idx]);
    idx++;
  }
  // Trim leading/trailing blank lines from description
  const description = descLines.join("\n").trim();

  // --- remaining ## sections ---
  const sections: Record<string, string> = {};
  let currentSection = "";
  const sectionLines: string[] = [];

  while (idx < lines.length) {
    if (lines[idx].startsWith("## ")) {
      // Flush previous section
      if (currentSection) {
        sections[currentSection] = sectionLines.join("\n").trim();
        sectionLines.length = 0;
      }
      currentSection = lines[idx].replace(/^## /, "").trim();
      idx++;
    } else {
      sectionLines.push(lines[idx]);
      idx++;
    }
  }
  // Flush last section
  if (currentSection) {
    sections[currentSection] = sectionLines.join("\n").trim();
  }

  return { frontmatter, title, description, sections };
}

// ---------------------------------------------------------------------------
// Section replacement
// ---------------------------------------------------------------------------

/**
 * Replace a named `## Section` block in a SKILL.md file.
 *
 * If the section does not exist, appends it at the end.
 */
export function replaceSection(content: string, sectionName: string, newContent: string): string {
  const lines = content.split("\n");
  const heading = `## ${sectionName}`;
  let startIdx = -1;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].startsWith(heading) &&
      (lines[i].length === heading.length || lines[i][heading.length] === " ")
    ) {
      startIdx = i;
      // Find end: next ## heading or EOF
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].startsWith("## ")) {
          endIdx = j;
          break;
        }
      }
      break;
    }
  }

  if (startIdx === -1) {
    // Section not found — append
    const trimmed = content.trimEnd();
    return `${trimmed}\n\n${heading}\n\n${newContent}\n`;
  }

  const before = lines.slice(0, startIdx);
  const after = lines.slice(endIdx);
  return [...before, heading, "", newContent, "", ...after].join("\n");
}

/**
 * Replace the entire body below frontmatter with a proposed body.
 *
 * Preserves frontmatter (if present) and the `# Title` line intact.
 */
export function replaceBody(currentContent: string, proposedBody: string): string {
  const parsed = parseSkillSections(currentContent);
  const parts: string[] = [];

  if (parsed.frontmatter) {
    parts.push(parsed.frontmatter);
    parts.push("");
  }
  if (parsed.title) {
    parts.push(parsed.title);
    parts.push("");
  }
  parts.push(proposedBody);

  return `${parts.join("\n").trimEnd()}\n`;
}

// ---------------------------------------------------------------------------
// Commit message builder
// ---------------------------------------------------------------------------

/** Build a commit message that includes the skill name and pass rate change. */
export function buildCommitMessage(
  proposal: EvolutionProposal,
  validation: ValidationResult,
): string {
  const changePercent = Math.round(validation.net_change * 100);
  const sign = changePercent >= 0 ? "+" : "";
  const passRateStr = `${sign}${changePercent}% pass rate`;

  return `evolve(${proposal.skill_name}): ${passRateStr}`;
}

// ---------------------------------------------------------------------------
// Main deploy function
// ---------------------------------------------------------------------------

/** Deploy a validated evolution proposal to the local SKILL.md. */
export async function deployProposal(options: DeployOptions): Promise<DeployResult> {
  const { proposal, validation, skillPath } = options;

  // Step 1: Read current SKILL.md
  const currentContent = readSkillMd(skillPath);

  // Step 2: Create backup (unique per deploy to avoid overwriting previous backups)
  const backupTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${skillPath}.${backupTimestamp}.bak`;
  copyFileSync(skillPath, backupPath);

  // Step 3: Replace description and write
  const updatedContent = replaceDescription(currentContent, proposal.proposed_description);
  writeFileSync(skillPath, updatedContent, "utf-8");

  // Step 4: Build commit message
  const commitMessage = buildCommitMessage(proposal, validation);

  return {
    skillMdUpdated: true,
    backupPath,
    commitMessage,
  };
}

// ---------------------------------------------------------------------------
// CLI entry guard
// ---------------------------------------------------------------------------

if (import.meta.main) {
  console.log("deploy-proposal: use deployProposal() programmatically or via evolve CLI");
}
