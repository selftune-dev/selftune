import { describe, expect, test } from "bun:test";

import { type SyncOptions, type SyncStepResult, syncSources } from "../cli/selftune/sync.js";

const baseOptions: SyncOptions = {
  projectsDir: "/tmp/claude-projects",
  codexHome: "/tmp/codex",
  opencodeDataDir: "/tmp/opencode",
  openclawAgentsDir: "/tmp/openclaw",
  skillLogPath: "/tmp/skill-log.jsonl",
  repairedSkillLogPath: "/tmp/repaired-skill-log.jsonl",
  repairedSessionsPath: "/tmp/repaired-sessions.json",
  dryRun: true,
  force: false,
  syncClaude: true,
  syncCodex: true,
  syncOpenCode: true,
  syncOpenClaw: true,
  rebuildSkillUsage: true,
};

function step(overrides: Partial<SyncStepResult> = {}): SyncStepResult {
  return {
    available: true,
    scanned: 0,
    synced: 0,
    skipped: 0,
    ...overrides,
  };
}

describe("syncSources", () => {
  test("aggregates enabled source-truth steps and repair summary", () => {
    const result = syncSources(baseOptions, {
      syncClaude: () => step({ scanned: 10, synced: 3, skipped: 1 }),
      syncCodex: () => step({ scanned: 4, synced: 2 }),
      syncOpenCode: () => step({ available: false }),
      syncOpenClaw: () => step({ scanned: 8, synced: 5 }),
      rebuildSkillUsage: () => ({
        repairedSessions: 7,
        repairedRecords: 12,
        codexRepairedRecords: 4,
      }),
    });

    expect(result.sources.claude).toEqual(step({ scanned: 10, synced: 3, skipped: 1 }));
    expect(result.sources.codex).toEqual(step({ scanned: 4, synced: 2 }));
    expect(result.sources.opencode).toEqual(step({ available: false }));
    expect(result.sources.openclaw).toEqual(step({ scanned: 8, synced: 5 }));
    expect(result.repair).toEqual({
      ran: true,
      repaired_sessions: 7,
      repaired_records: 12,
      codex_repaired_records: 4,
    });
  });

  test("respects disabled steps", () => {
    const result = syncSources(
      {
        ...baseOptions,
        syncCodex: false,
        syncOpenCode: false,
        rebuildSkillUsage: false,
      },
      {
        syncClaude: () => step({ scanned: 2, synced: 2 }),
        syncOpenClaw: () => step({ scanned: 1, synced: 1 }),
      },
    );

    expect(result.sources.claude).toEqual(step({ scanned: 2, synced: 2 }));
    expect(result.sources.codex).toEqual({
      available: false,
      scanned: 0,
      synced: 0,
      skipped: 0,
    });
    expect(result.sources.opencode).toEqual({
      available: false,
      scanned: 0,
      synced: 0,
      skipped: 0,
    });
    expect(result.sources.openclaw).toEqual(step({ scanned: 1, synced: 1 }));
    expect(result.repair).toEqual({
      ran: false,
      repaired_sessions: 0,
      repaired_records: 0,
      codex_repaired_records: 0,
    });
  });
});
