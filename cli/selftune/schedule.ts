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

// ---------------------------------------------------------------------------
// Schedule definitions (matches the selftune automation loop)
// ---------------------------------------------------------------------------

export interface ScheduleEntry {
  name: string;
  schedule: string;
  command: string;
  description: string;
}

export const SCHEDULE_ENTRIES: ScheduleEntry[] = [
  {
    name: "selftune-sync",
    schedule: "*/30 * * * *",
    command: "selftune sync",
    description: "Sync source-truth telemetry every 30 minutes",
  },
  {
    name: "selftune-status",
    schedule: "0 8 * * *",
    command: "selftune sync && selftune status",
    description: "Daily health check at 8am (syncs first)",
  },
  {
    name: "selftune-evolve",
    schedule: "0 3 * * 0",
    command: "selftune evolve --sync-first --skill <name> --skill-path <path>",
    description: "Weekly evolution at 3am Sunday",
  },
  {
    name: "selftune-watch",
    schedule: "0 */6 * * *",
    command: "selftune watch --sync-first --skill <name> --skill-path <path>",
    description: "Monitor regressions every 6 hours",
  },
];

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
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!--
  selftune automation — macOS launchd agent.

  Install:
    cp com.selftune.sync.plist ~/Library/LaunchAgents/
    launchctl load ~/Library/LaunchAgents/com.selftune.sync.plist

  This example runs \`selftune sync\` every 30 minutes.
  Create similar plists for status, evolve, and watch,
  or combine them into a single wrapper script.
-->
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.selftune.sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>selftune</string>
    <string>sync</string>
  </array>
  <key>StartInterval</key>
  <integer>1800</integer>
  <key>StandardOutPath</key>
  <string>/tmp/selftune-sync.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/selftune-sync.err</string>
</dict>
</plist>`;
  return plist;
}

export function generateSystemd(): string {
  const timer = `# selftune automation — systemd timer + service
#
# Install:
#   cp selftune-sync.service selftune-sync.timer ~/.config/systemd/user/
#   systemctl --user daemon-reload
#   systemctl --user enable --now selftune-sync.timer
#
# Create similar pairs for status, evolve, and watch,
# or combine them into a single wrapper script.

# --- selftune-sync.timer ---
[Unit]
Description=selftune sync timer

[Timer]
OnCalendar=*:0/30
Persistent=true

[Install]
WantedBy=timers.target

# --- selftune-sync.service ---
[Unit]
Description=selftune sync

[Service]
Type=oneshot
ExecStart=selftune sync`;
  return timer;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const VALID_FORMATS = ["cron", "launchd", "systemd"] as const;
export type ScheduleFormat = (typeof VALID_FORMATS)[number];

function isValidFormat(value: string): value is ScheduleFormat {
  return (VALID_FORMATS as readonly string[]).includes(value);
}

export function formatOutput(format?: string): { ok: true; data: string } | { ok: false; error: string } {
  if (format && !isValidFormat(format)) {
    return { ok: false, error: `Unknown format "${format}". Valid formats: ${VALID_FORMATS.join(", ")}` };
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
