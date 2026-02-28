import { describe, expect, test } from "bun:test";
import { checkHookInstallation, checkLogHealth, doctor } from "../cli/selftune/observability.js";

describe("checkLogHealth", () => {
  test("returns checks for all three log files", () => {
    const checks = checkLogHealth();
    expect(checks.length).toBe(3);
    const names = checks.map((c) => c.name);
    expect(names).toContain("log_session_telemetry");
    expect(names).toContain("log_skill_usage");
    expect(names).toContain("log_all_queries");
  });

  test("each check has required fields", () => {
    const checks = checkLogHealth();
    for (const check of checks) {
      expect(check).toHaveProperty("name");
      expect(check).toHaveProperty("path");
      expect(check).toHaveProperty("status");
      expect(check).toHaveProperty("message");
      expect(["pass", "fail", "warn"]).toContain(check.status);
    }
  });
});

describe("checkHookInstallation", () => {
  test("returns checks for all three hooks", () => {
    const checks = checkHookInstallation();
    expect(checks.length).toBe(3);
  });

  test("finds installed hook files", () => {
    // The hooks should exist since we created them
    const checks = checkHookInstallation();
    const passing = checks.filter((c) => c.status === "pass");
    expect(passing.length).toBe(3);
  });
});

describe("doctor", () => {
  test("returns structured result", () => {
    const result = doctor();
    expect(result.command).toBe("doctor");
    expect(result).toHaveProperty("timestamp");
    expect(result).toHaveProperty("checks");
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("healthy");
    expect(typeof result.healthy).toBe("boolean");
    expect(result.summary.total).toBe(result.checks.length);
    expect(result.summary.pass + result.summary.fail + result.summary.warn).toBe(
      result.summary.total,
    );
  });
});
