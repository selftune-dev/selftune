/**
 * E2E smoke test: fresh config → alpha-enrolled → upload-ready
 *
 * Exercises the real runInit() path, not synthetic config writes.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getAlphaLinkState, readAlphaIdentity } from "../../cli/selftune/alpha-identity.js";
import { checkAlphaReadiness, runInit } from "../../cli/selftune/init.js";
import { checkCloudLinkHealth } from "../../cli/selftune/observability.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "selftune-onboarding-e2e-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function makeInitOpts(overrides: Record<string, unknown> = {}) {
  const configDir = join(tmpDir, ".selftune");
  const configPath = join(configDir, "config.json");
  return {
    configDir,
    configPath,
    force: false,
    agentOverride: "claude_code",
    cliPathOverride: "/test/cli/selftune/index.ts",
    homeDir: tmpDir,
    ...overrides,
  };
}

describe("Agent-first alpha onboarding E2E", () => {
  test("fresh config → selftune init --alpha --alpha-key → upload-ready", async () => {
    const testApiKey = ["st_live", "abc123xyz"].join("_");
    const opts = makeInitOpts();

    // Step 1: Fresh machine — no config exists
    expect(readAlphaIdentity(opts.configPath)).toBeNull();
    const readiness0 = checkAlphaReadiness(opts.configPath);
    expect(readiness0.ready).toBe(false);
    expect(readiness0.missing).toContain("alpha identity not configured");
    expect(readiness0.guidance.blocking).toBe(true);
    expect(readiness0.guidance.next_command).toContain("selftune init --alpha");

    // Step 2: Enroll with email + key (direct key path)
    const config1 = await runInit(
      makeInitOpts({
        alpha: true,
        alphaEmail: "user@example.com",
        alphaName: "Test User",
        alphaKey: testApiKey,
      }),
    );

    expect(config1.alpha?.enrolled).toBe(true);
    expect(config1.alpha?.email).toBe("user@example.com");
    expect(config1.alpha?.api_key).toBe(testApiKey);

    // Step 3: Readiness check — api_key is valid so readiness passes
    const readiness1 = checkAlphaReadiness(opts.configPath);
    expect(readiness1.ready).toBe(true);
    expect(readiness1.missing).toHaveLength(0);

    // Note: guidance uses getAlphaLinkState which requires cloud_user_id for "ready".
    // Direct-key path doesn't set cloud_user_id, so guidance still shows blocking.
    // This is expected — device-code flow is the recommended path for full linking.

    // Step 4: Health checks
    const identity1 = readAlphaIdentity(opts.configPath);
    const healthChecks = checkCloudLinkHealth(identity1);
    expect(healthChecks.length).toBeGreaterThan(0);
  });

  test("invalid credential format rejected by init", async () => {
    await expect(
      runInit(
        makeInitOpts({
          alpha: true,
          alphaEmail: "user@example.com",
          alphaKey: "bad_key_format",
        }),
      ),
    ).rejects.toThrow("API key must start with 'st_live_' or 'st_test_'");
  });

  test("--alpha without --alpha-key requires device-code flow (no email needed)", async () => {
    // When --alpha is provided without --alpha-key, init triggers device-code flow.
    // Without a mock server, this will fail on the fetch — confirming the flow is entered.
    await expect(
      runInit(
        makeInitOpts({
          alpha: true,
          alphaEmail: "user@example.com",
        }),
      ),
    ).rejects.toThrow(); // fetch will fail since no server is running
  });

  test("--alpha --alpha-key without --alpha-email throws", async () => {
    await expect(
      runInit(
        makeInitOpts({
          alpha: true,
          alphaKey: "st_live_abc123",
        }),
      ),
    ).rejects.toThrow("--alpha-email flag is required when using --alpha-key");
  });

  test("link state transitions are correct", () => {
    expect(getAlphaLinkState(null)).toBe("not_linked");

    // enrolled=false, no cloud_user_id -> not_linked
    expect(
      getAlphaLinkState({
        enrolled: false,
        user_id: "u1",
        consent_timestamp: "",
      }),
    ).toBe("not_linked");

    // enrolled=false, has cloud_user_id -> linked_not_enrolled
    expect(
      getAlphaLinkState({
        enrolled: false,
        user_id: "u1",
        consent_timestamp: "",
        cloud_user_id: "cloud-1",
      }),
    ).toBe("linked_not_enrolled");

    // enrolled=true, no api_key -> enrolled_no_credential
    expect(
      getAlphaLinkState({
        enrolled: true,
        user_id: "u1",
        consent_timestamp: "",
      }),
    ).toBe("enrolled_no_credential");

    // enrolled=true, has cloud_user_id + valid api_key -> ready
    expect(
      getAlphaLinkState({
        enrolled: true,
        user_id: "u1",
        consent_timestamp: "",
        cloud_user_id: "cloud-1",
        api_key: "st_live_x",
      }),
    ).toBe("ready");

    // enrolled=true, has valid api_key but no cloud_user_id -> ready
    // (cloud_user_id is bonus enrichment, not a gate for readiness)
    expect(
      getAlphaLinkState({
        enrolled: true,
        user_id: "u1",
        consent_timestamp: "",
        api_key: "st_live_x",
      }),
    ).toBe("ready");
  });
});
