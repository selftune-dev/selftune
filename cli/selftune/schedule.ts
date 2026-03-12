#!/usr/bin/env bun
/**
 * selftune schedule — Generate scheduling examples for automated selftune runs.
 *
 * Outputs ready-to-use snippets for system cron, macOS launchd, and Linux systemd.
 * This is the generic, agent-agnostic way to automate selftune.
 *
 * For OpenClaw-specific scheduling, see `selftune cron`.
 *
 * Usage:
 *   selftune schedule [--format cron|launchd|systemd]
 */

import { parseArgs } from "node:util";

import { DEFAULT_CRON_JOBS } from "./cron/setup.js";

// ---------------------------------------------------------------------------
// Schedule definitions — derived from the shared DEFAULT_CRON_JOBS
// ---------------------------------------------------------------------------

export interface ScheduleEntry {
  name: string;
  schedule: string;
  command: string;
  description: string;
}

/** Map cron job metadata to schedule entries with CLI commands. */
function commandForJob(jobName: string): string {
  switch (jobName) {
    case "selftune-sync":
      return "selftune sync";
    case "selftune-status":
      return "selftune sync && selftune status";
    case "selftune-evolve":
      return "selftune evolve --sync-first --skill <name> --skill-path <path>";
    case "selftune-watch":
      return "selftune watch --sync-first --skill <name> --skill-path <path>";
    default:
      return `selftune ${jobName.replace("selftune-", "")}`;
  }
}

export const SCHEDULE_ENTRIES: ScheduleEntry[] = DEFAULT_CRON_JOBS.map((job) => ({
  name: job.name,
  schedule: job.cron,
  command: commandForJob(job.name),
  description: job.description,
}));

// ---------------------------------------------------------------------------
// Helpers for launchd/systemd generation
// ---------------------------------------------------------------------------

/** Convert a cron schedule to a launchd StartInterval in seconds (best-effort). */
function cronToInterval(cron: string): number {
  // Simple heuristic for common patterns
  if (cron.startsWith("*/")) {
    const minutes = Number.parseInt(cron.split(" ")[0].replace("*/", ""), 10);
    return minutes * 60;
  }
  if (cron.startsWith("0 */")) {
    const hours = Number.parseInt(cron.split(" ")[1].replace("*/", ""), 10);
    return hours * 3600;
  }
  if (cron.startsWith("0 ") && cron.includes("* * 0")) {
    return 604800; // weekly
  }
  if (cron.startsWith("0 ") && cron.endsWith("* * *")) {
    return 86400; // daily
  }
  return 1800; // default 30 min
}

/** Convert a cron schedule to a systemd OnCalendar value (best-effort). */
function cronToOnCalendar(cron: string): string {
  if (cron === "*/30 * * * *") return "*:0/30";
  if (cron === "0 8 * * *") return "*-*-* 08:00:00";
  if (cron === "0 3 * * 0") return "Sun *-*-* 03:00:00";
  if (cron === "0 */6 * * *") return "*-*-* 0/6:00:00";
  // Fallback: return cron expression in a comment
  return cron;
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export function generateCrontab(): string {
  const lines = [
    "# selftune automation — add to your crontab with: crontab -e",
    "#",
    "# The core loop: sync → status → evolve → watch",
    "# Adjust paths and skill names for your setup.",
    "#",
  ];
  for (const entry of SCHEDULE_ENTRIES) {
    lines.push(`# ${entry.description}`);
    lines.push(`${entry.schedule}  ${entry.command}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function generateLaunchd(): string {
  const plists: string[] = [];

  for (const entry of SCHEDULE_ENTRIES) {
    const label = `com.selftune.${entry.name.replace("selftune-", "")}`;
    const lastCmd = entry.command.split(" && ").pop() ?? entry.command;
    const args = lastCmd
      .split(" ")
      .map((a) => `    <string>${a}</string>`)
      .join("\n");
    const interval = cronToInterval(entry.schedule);

    plists.push(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!--
  ${entry.description}

  Install:
    cp ${label}.plist ~/Library/LaunchAgents/
    launchctl load ~/Library/LaunchAgents/${label}.plist
-->
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>StartInterval</key>
  <integer>${interval}</integer>
  <key>StandardOutPath</key>
  <string>/tmp/${entry.name}.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/${entry.name}.err</string>
</dict>
</plist>`);
  }

  return plists.join("\n\n");
}

export function generateSystemd(): string {
  const units: string[] = [];

  for (const entry of SCHEDULE_ENTRIES) {
    const unitName = entry.name;
    const calendar = cronToOnCalendar(entry.schedule);
    const execStart = (entry.command.split(" && ").pop() ?? entry.command).trim();

    units.push(`# --- ${unitName}.timer ---
# ${entry.description}
#
# Install:
#   cp ${unitName}.service ${unitName}.timer ~/.config/systemd/user/
#   systemctl --user daemon-reload
#   systemctl --user enable --now ${unitName}.timer

[Unit]
Description=${entry.description}

[Timer]
OnCalendar=${calendar}
Persistent=true

[Install]
WantedBy=timers.target

# --- ${unitName}.service ---
[Unit]
Description=${entry.description}

[Service]
Type=oneshot
ExecStart=${execStart}`);
  }

  return units.join("\n\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const VALID_FORMATS = ["cron", "launchd", "systemd"] as const;
export type ScheduleFormat = (typeof VALID_FORMATS)[number];

function isValidFormat(value: string): value is ScheduleFormat {
  return (VALID_FORMATS as readonly string[]).includes(value);
}

export function formatOutput(
  format?: string,
): { ok: true; data: string } | { ok: false; error: string } {
  if (format && !isValidFormat(format)) {
    return {
      ok: false,
      error: `Unknown format "${format}". Valid formats: ${VALID_FORMATS.join(", ")}`,
    };
  }

  const sections: string[] = [];

  if (!format || format === "cron") {
    sections.push("## System cron\n");
    sections.push(generateCrontab());
  }

  if (!format || format === "launchd") {
    sections.push("## macOS launchd\n");
    sections.push(generateLaunchd());
  }

  if (!format || format === "systemd") {
    sections.push("## Linux systemd\n");
    sections.push(generateSystemd());
  }

  return { ok: true, data: sections.join("\n\n") };
}

export function cliMain(): void {
  const { values } = parseArgs({
    options: {
      format: { type: "string", short: "f" },
      help: { type: "boolean", default: false },
    },
    strict: false,
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`selftune schedule — Generate scheduling examples for automation

Usage:
  selftune schedule [--format cron|launchd|systemd]

Flags:
  --format, -f    Output only one format (cron, launchd, or systemd)
  --help          Show this help message

The selftune automation loop is:
  sync → status → evolve --sync-first → watch --sync-first

This command generates ready-to-use snippets for running that loop
with standard system scheduling tools. No agent runtime required.

For OpenClaw-specific scheduling, see: selftune cron`);
    process.exit(0);
  }

  const result = formatOutput(values.format);
  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }
  console.log(result.data);
}

if (import.meta.main) {
  cliMain();
}
