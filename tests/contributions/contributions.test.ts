import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const configDir = mkdtempSync(join(tmpdir(), "selftune-contributions-test-"));
process.env.SELFTUNE_CONFIG_DIR = configDir;

const contributionsMod = await import("../../cli/selftune/contributions.js");

const { cliMain, loadContributionPreferences, resetContributionPreferencesState } =
  contributionsMod;

const originalArgv = [...process.argv];
const originalLog = console.log;

beforeEach(() => {
  resetContributionPreferencesState();
  process.argv = [...originalArgv];
  const prefsPath = join(configDir, "contribution-preferences.json");
  try {
    rmSync(prefsPath, { force: true });
  } catch {
    // ignore
  }
});

afterAll(() => {
  console.log = originalLog;
  process.argv = originalArgv;
  rmSync(configDir, { recursive: true, force: true });
});

describe("contributions preferences", () => {
  test("loads defaults when no file exists", () => {
    const prefs = loadContributionPreferences();
    expect(prefs.global_default).toBe("ask");
    expect(prefs.skills).toEqual({});
  });

  test("approve persists opted-in state", async () => {
    process.argv = ["bun", "selftune", "approve", "sc-search"];
    console.log = mock(() => {});
    await cliMain();

    const prefs = loadContributionPreferences();
    expect(prefs.skills["sc-search"]?.status).toBe("opted_in");
    expect(typeof prefs.skills["sc-search"]?.opted_in_at).toBe("string");
  });

  test("revoke persists opted-out state", async () => {
    process.argv = ["bun", "selftune", "revoke", "sc-search"];
    console.log = mock(() => {});
    await cliMain();

    const prefs = loadContributionPreferences();
    expect(prefs.skills["sc-search"]?.status).toBe("opted_out");
    expect(typeof prefs.skills["sc-search"]?.opted_out_at).toBe("string");
  });

  test("default updates global behavior", async () => {
    process.argv = ["bun", "selftune", "default", "never"];
    console.log = mock(() => {});
    await cliMain();

    const prefs = JSON.parse(
      readFileSync(join(configDir, "contribution-preferences.json"), "utf-8"),
    ) as { global_default: string };
    expect(prefs.global_default).toBe("never");
  });

  test("status prints separation from contribute and alpha upload", async () => {
    const lines: string[] = [];
    console.log = mock((...args: unknown[]) => {
      lines.push(args.join(" "));
    });
    process.argv = ["bun", "selftune"];
    await cliMain();

    expect(lines.join("\n")).toContain("selftune contribute");
    expect(lines.join("\n")).toContain("selftune push / alpha");
  });
});
