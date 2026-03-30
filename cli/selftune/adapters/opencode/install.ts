#!/usr/bin/env bun
/**
 * Install selftune hooks into OpenCode environment.
 *
 * Writes a shell shim script that OpenCode calls for hook events,
 * and updates the OpenCode config to reference the shim.
 *
 * Config locations (checked in order):
 *   1. ./opencode.json           (project-level)
 *   2. ~/.config/opencode/config.json  (user-level)
 *
 * Usage: selftune opencode install [--dry-run] [--uninstall]
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHIM_NAME = "selftune-opencode-hook.sh";
const SELFTUNE_TAG = "selftune-managed";

const PROJECT_CONFIG = join(process.cwd(), "opencode.json");
const USER_CONFIG = join(homedir(), ".config", "opencode", "config.json");

// ---------------------------------------------------------------------------
// Shim content
// ---------------------------------------------------------------------------

function buildShimContent(): string {
  return `#!/bin/bash
# ${SELFTUNE_TAG} — Written by selftune. Do not edit.
# Pipes OpenCode hook events to selftune for processing.
cat | npx selftune opencode hook
`;
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

interface OpenCodeConfig {
  hooks?: Record<string, { command?: string }>;
  [key: string]: unknown;
}

function detectConfigPath(): string {
  if (existsSync(PROJECT_CONFIG)) return PROJECT_CONFIG;
  return USER_CONFIG;
}

function readConfig(configPath: string): OpenCodeConfig {
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, "utf-8")) as OpenCodeConfig;
  } catch {
    return {};
  }
}

function writeConfig(configPath: string, config: OpenCodeConfig): void {
  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

// ---------------------------------------------------------------------------
// Install logic
// ---------------------------------------------------------------------------

interface InstallOptions {
  dryRun: boolean;
  uninstall: boolean;
}

function parseFlags(args: string[]): InstallOptions {
  return {
    dryRun: args.includes("--dry-run"),
    uninstall: args.includes("--uninstall"),
  };
}

const HOOK_EVENTS = ["tool.execute.before", "tool.execute.after", "session.idle"] as const;

function doInstall(options: InstallOptions): void {
  const configPath = detectConfigPath();
  const shimDir = dirname(configPath);
  const shimPath = join(shimDir, SHIM_NAME);

  if (options.dryRun) {
    console.log(`[selftune] dry-run: would write shim to ${shimPath}`);
    console.log(`[selftune] dry-run: would update config at ${configPath}`);
    for (const event of HOOK_EVENTS) {
      console.log(`[selftune] dry-run: would register hook for ${event}`);
    }
    return;
  }

  // Write shim script
  if (!existsSync(shimDir)) {
    mkdirSync(shimDir, { recursive: true });
  }
  writeFileSync(shimPath, buildShimContent(), { mode: 0o755 });

  // Update config to point all hook events at the shim
  const config = readConfig(configPath);
  if (!config.hooks) {
    config.hooks = {};
  }

  for (const event of HOOK_EVENTS) {
    config.hooks[event] = { command: shimPath };
  }

  writeConfig(configPath, config);

  console.log(`[selftune] Installed OpenCode hooks:`);
  console.log(`  shim: ${shimPath}`);
  console.log(`  config: ${configPath}`);
  for (const event of HOOK_EVENTS) {
    console.log(`  ${event} -> ${shimPath}`);
  }
}

function doUninstall(options: InstallOptions): void {
  const configPath = detectConfigPath();
  const shimDir = dirname(configPath);
  const shimPath = join(shimDir, SHIM_NAME);

  if (options.dryRun) {
    console.log(`[selftune] dry-run: would remove shim at ${shimPath}`);
    console.log(`[selftune] dry-run: would remove hook entries from ${configPath}`);
    return;
  }

  // Remove shim
  if (existsSync(shimPath)) {
    unlinkSync(shimPath);
    console.log(`[selftune] Removed shim: ${shimPath}`);
  }

  // Remove hook entries from config
  if (existsSync(configPath)) {
    const config = readConfig(configPath);
    if (config.hooks) {
      for (const event of HOOK_EVENTS) {
        delete config.hooks[event];
      }
      // Clean up empty hooks object
      if (Object.keys(config.hooks).length === 0) {
        delete config.hooks;
      }
      writeConfig(configPath, config);
      console.log(`[selftune] Removed hook entries from: ${configPath}`);
    }
  }

  console.log(`[selftune] OpenCode hooks uninstalled.`);
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

export async function cliMain(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseFlags(args);

  if (options.uninstall) {
    doUninstall(options);
  } else {
    doInstall(options);
  }
}

// ---------------------------------------------------------------------------
// stdin main (only when executed directly, not when imported)
// ---------------------------------------------------------------------------

if (import.meta.main) {
  try {
    await cliMain();
  } catch (err) {
    console.error(
      `[selftune] OpenCode install failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}
