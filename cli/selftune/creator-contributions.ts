#!/usr/bin/env bun

import { parseArgs } from "node:util";

import { readAlphaIdentity } from "./alpha-identity.js";
import { SELFTUNE_CONFIG_PATH } from "./constants.js";
import {
  type CreatorContributionConfig,
  discoverCreatorContributionConfigs,
  findCreatorContributionConfig,
  removeCreatorContributionConfig,
  resolveContributionSkillPath,
  writeCreatorContributionConfig,
} from "./contribution-config.js";
import { CLIError } from "./utils/cli-error.js";
import { handleCLIError } from "./utils/cli-error.js";

function inferCreatorId(explicitCreatorId?: string): string | null {
  if (explicitCreatorId?.trim()) return explicitCreatorId.trim();
  const alpha = readAlphaIdentity(SELFTUNE_CONFIG_PATH);
  return alpha?.cloud_user_id?.trim() || null;
}

function printConfig(config: CreatorContributionConfig): void {
  console.log(`${config.skill_name}`);
  console.log(`  creator_id: ${config.creator_id}`);
  console.log(`  skill_path: ${config.skill_path}`);
  console.log(`  signals: ${config.contribution.signals.join(", ")}`);
  if (config.contribution.message) {
    console.log(`  message: ${config.contribution.message}`);
  }
  if (config.contribution.privacy_url) {
    console.log(`  privacy_url: ${config.contribution.privacy_url}`);
  }
}

function printStatus(skillName?: string): void {
  if (skillName) {
    const config = findCreatorContributionConfig(skillName);
    if (!config) {
      console.log(`No creator contribution config found for "${skillName}".`);
      return;
    }
    console.log("Creator contribution config:");
    printConfig(config);
    return;
  }

  const configs = discoverCreatorContributionConfigs();
  if (configs.length === 0) {
    console.log("No creator contribution configs discovered.");
    console.log("Use `selftune creator-contributions enable --skill <name>` to add one.");
    return;
  }

  console.log("Discovered creator contribution configs:");
  for (const config of configs) {
    printConfig(config);
  }
}

export async function cliMain(): Promise<void> {
  const sub = process.argv[2];
  const rest = process.argv.slice(3);

  if (sub === "--help" || sub === "-h") {
    console.log(`selftune creator-contributions — Manage creator-side contribution configs

Usage:
  selftune creator-contributions
  selftune creator-contributions status [--skill <name>]
  selftune creator-contributions enable --skill <name> [--skill-path <path>] [--creator-id <id>] [--signals a,b,c]
  selftune creator-contributions disable --skill <name> [--skill-path <path>]

Purpose:
  Manage the local selftune.contribute.json file that a skill creator bundles
  with a skill package. This is separate from:
    selftune contributions  End-user sharing preferences
    selftune contribute     Community export bundle`);
    return;
  }

  const normalizedSub = sub ?? "status";

  switch (normalizedSub) {
    case "status": {
      const { values } = parseArgs({
        args: rest,
        options: {
          skill: { type: "string" },
          help: { type: "boolean", short: "h", default: false },
        },
        strict: true,
      });
      if (values.help) {
        console.log("Usage: selftune creator-contributions status [--skill <name>]");
        return;
      }
      printStatus(values.skill);
      return;
    }
    case "enable": {
      const { values } = parseArgs({
        args: rest,
        options: {
          skill: { type: "string" },
          "skill-path": { type: "string" },
          "creator-id": { type: "string" },
          signals: { type: "string", default: "trigger,grade,miss_category" },
          message: { type: "string" },
          "privacy-url": { type: "string" },
          help: { type: "boolean", short: "h", default: false },
        },
        strict: true,
      });
      if (values.help) {
        console.log(
          "Usage: selftune creator-contributions enable --skill <name> [--skill-path <path>] [--creator-id <id>]",
        );
        return;
      }

      const skillName = values.skill?.trim();
      if (!skillName) {
        throw new CLIError(
          "Skill name is required.",
          "MISSING_FLAG",
          "selftune creator-contributions enable --skill <name>",
        );
      }

      const creatorId = inferCreatorId(values["creator-id"]);
      if (!creatorId) {
        throw new CLIError(
          "Creator ID is required.",
          "MISSING_FLAG",
          "Pass --creator-id <id> or enroll alpha so cloud_user_id is available.",
        );
      }

      const skillPath = resolveContributionSkillPath(skillName, values["skill-path"]);
      if (!skillPath) {
        throw new CLIError(
          `Could not resolve SKILL.md for "${skillName}".`,
          "FILE_NOT_FOUND",
          "Pass --skill-path /path/to/SKILL.md",
        );
      }

      const signals = (values.signals ?? "trigger,grade,miss_category")
        .split(",")
        .map((signal) => signal.trim())
        .filter(Boolean);
      const config = writeCreatorContributionConfig({
        creator_id: creatorId,
        skill_name: skillName,
        skill_path: skillPath,
        signals,
        message: values.message,
        privacy_url: values["privacy-url"],
      });
      console.log(`Enabled creator contribution config for "${skillName}".`);
      printConfig(config);
      return;
    }
    case "disable": {
      const { values } = parseArgs({
        args: rest,
        options: {
          skill: { type: "string" },
          "skill-path": { type: "string" },
          help: { type: "boolean", short: "h", default: false },
        },
        strict: true,
      });
      if (values.help) {
        console.log(
          "Usage: selftune creator-contributions disable --skill <name> [--skill-path <path>]",
        );
        return;
      }

      const skillName = values.skill?.trim();
      if (!skillName) {
        throw new CLIError(
          "Skill name is required.",
          "MISSING_FLAG",
          "selftune creator-contributions disable --skill <name>",
        );
      }
      const skillPath = resolveContributionSkillPath(skillName, values["skill-path"]);
      if (!skillPath) {
        throw new CLIError(
          `Could not resolve SKILL.md for "${skillName}".`,
          "FILE_NOT_FOUND",
          "Pass --skill-path /path/to/SKILL.md",
        );
      }

      const removed = removeCreatorContributionConfig(skillPath);
      if (!removed) {
        console.log(`No creator contribution config found for "${skillName}".`);
        return;
      }
      console.log(`Disabled creator contribution config for "${skillName}".`);
      return;
    }
    default:
      throw new CLIError(
        `Unknown creator-contributions subcommand: ${normalizedSub}`,
        "UNKNOWN_COMMAND",
        "selftune creator-contributions --help",
      );
  }
}

if (import.meta.main) {
  cliMain().catch(handleCLIError);
}
