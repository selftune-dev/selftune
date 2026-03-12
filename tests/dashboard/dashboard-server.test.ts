import { afterAll, beforeAll, describe, expect, it } from "bun:test";

/**
 * Dashboard server tests — validates HTTP endpoints, SSE streaming,
 * action handlers, and server lifecycle.
 *
 * Strategy: spawn actual server on port 0 (random), test with fetch, clean up.
 */

// Dynamic import to avoid module-level failures when file doesn't exist yet
let startDashboardServer: typeof import("../../cli/selftune/dashboard-server.js").startDashboardServer;
const fakeData = {
  telemetry: [{ timestamp: "2026-03-12T10:00:00Z", session_id: "sess-1" }],
  skills: [
    {
      timestamp: "2026-03-12T10:00:00Z",
      session_id: "sess-1",
      skill_name: "test-skill",
      skill_path: "/tmp/test-skill/SKILL.md",
      query: "test prompt",
      triggered: true,
    },
  ],
  queries: [{ timestamp: "2026-03-12T10:00:00Z", session_id: "sess-1", query: "test prompt" }],
  evolution: [],
  evidence: [],
  decisions: [],
  computed: {
    snapshots: {
      "test-skill": {
        window_sessions: 1,
        pass_rate: 1,
        false_negative_rate: 0,
        regression_detected: false,
        baseline_pass_rate: 0.5,
        skill_checks: 1,
      },
    },
    unmatched: [],
    pendingProposals: [],
  },
};

beforeAll(async () => {
  const mod = await import("../../cli/selftune/dashboard-server.js");
  startDashboardServer = mod.startDashboardServer;
});

describe("dashboard-server", () => {
  let server: { server: unknown; stop: () => void; port: number };

  beforeAll(async () => {
    server = await startDashboardServer({
      port: 0, // random port
      host: "localhost",
      openBrowser: false,
      dataLoader: () => fakeData,
      statusLoader: () => ({
        skills: [
          {
            name: "test-skill",
            passRate: 1,
            trend: "stable",
            missedQueries: 0,
            status: "HEALTHY",
            snapshot: null,
          },
        ],
        unmatchedQueries: 0,
        pendingProposals: 0,
        lastSession: "2026-03-12T10:00:00Z",
        system: {
          healthy: true,
          pass: 1,
          fail: 0,
          warn: 0,
        },
      }),
      actionRunner: async (command) => ({
        success: command !== "rollback",
        output: `${command} ok`,
        error: command === "rollback" ? "rollback blocked in test" : null,
      }),
    });
  });

  afterAll(() => {
    server?.stop();
  });

  // ---- GET / ----
  describe("GET /", () => {
    it("returns 200 with HTML content", async () => {
      const res = await fetch(`http://localhost:${server.port}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
    });

    it("contains the selftune title", async () => {
      const res = await fetch(`http://localhost:${server.port}/`);
      const html = await res.text();
      expect(html).toContain("selftune");
    });

    it("sets the live mode flag", async () => {
      const res = await fetch(`http://localhost:${server.port}/`);
      const html = await res.text();
      expect(html).toContain("__SELFTUNE_LIVE__");
    });
  });

  // ---- GET /api/data ----
  describe("GET /api/data", () => {
    it("returns 200 with JSON", async () => {
      const res = await fetch(`http://localhost:${server.port}/api/data`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/json");
    });

    it("returns expected data shape", async () => {
      const res = await fetch(`http://localhost:${server.port}/api/data`);
      const data = await res.json();
      expect(data).toHaveProperty("telemetry");
      expect(data).toHaveProperty("skills");
      expect(data).toHaveProperty("queries");
      expect(data).toHaveProperty("evolution");
      expect(data).toHaveProperty("evidence");
      expect(data).toHaveProperty("computed");
      expect(Array.isArray(data.telemetry)).toBe(true);
      expect(Array.isArray(data.skills)).toBe(true);
      expect(Array.isArray(data.queries)).toBe(true);
      expect(Array.isArray(data.evolution)).toBe(true);
      expect(Array.isArray(data.evidence)).toBe(true);
    });

    it("includes decisions in the data", async () => {
      const res = await fetch(`http://localhost:${server.port}/api/data`);
      const data = await res.json();
      expect(data).toHaveProperty("decisions");
      expect(Array.isArray(data.decisions)).toBe(true);
    });
  });

  // ---- GET /api/events (SSE) ----
  describe("GET /api/events", () => {
    it("returns SSE content type", async () => {
      const controller = new AbortController();
      const res = await fetch(`http://localhost:${server.port}/api/events`, {
        signal: controller.signal,
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");
      controller.abort();
    });

    it("sends initial data event", async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`http://localhost:${server.port}/api/events`, {
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      expect(reader).toBeDefined();
      if (!reader) throw new Error("Response body reader is null");
      const decoder = new TextDecoder();
      let accumulated = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          // Wait for a complete SSE event (double newline terminates an event)
          if (accumulated.includes("\n\n")) break;
        }
      } catch {
        // abort expected
      } finally {
        clearTimeout(timeout);
        controller.abort();
      }

      expect(accumulated).toContain("event: data");
      // The data line should be parseable JSON
      const dataMatch = accumulated.match(/data: (.+)/);
      expect(dataMatch).not.toBeNull();
      if (dataMatch) {
        const parsed = JSON.parse(dataMatch[1]);
        expect(parsed).toHaveProperty("telemetry");
      }
    });
  });

  // ---- POST /api/actions/watch ----
  describe("POST /api/actions/watch", () => {
    it("returns JSON response", async () => {
      const res = await fetch(`http://localhost:${server.port}/api/actions/watch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill: "test-skill", skillPath: "/tmp/test-skill" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("success");
      // May fail since skill doesn't exist, but shape should be correct
      expect(typeof data.success).toBe("boolean");
      expect(data).toHaveProperty("output");
      expect(data).toHaveProperty("error");
    });
  });

  // ---- POST /api/actions/evolve ----
  describe("POST /api/actions/evolve", () => {
    it("returns JSON response", async () => {
      const res = await fetch(`http://localhost:${server.port}/api/actions/evolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill: "test-skill", skillPath: "/tmp/test-skill" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("success");
      expect(typeof data.success).toBe("boolean");
    });
  });

  // ---- POST /api/actions/rollback ----
  describe("POST /api/actions/rollback", () => {
    it("returns JSON response with proposalId validation", async () => {
      const res = await fetch(`http://localhost:${server.port}/api/actions/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill: "test-skill",
          skillPath: "/tmp/test-skill",
          proposalId: "test-proposal-123",
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("success");
      expect(typeof data.success).toBe("boolean");
    });
  });

  // ---- GET /api/evaluations/:skillName ----
  describe("GET /api/evaluations/:skillName", () => {
    it("returns 200 with JSON array", async () => {
      const res = await fetch(
        `http://localhost:${server.port}/api/evaluations/${encodeURIComponent("test-skill")}`,
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/json");
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it("returns entries with expected shape when data exists", async () => {
      const res = await fetch(
        `http://localhost:${server.port}/api/evaluations/${encodeURIComponent("test-skill")}`,
      );
      const data = await res.json();
      // May be empty if no skill_usage_log.jsonl entries match, but shape is still an array
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0]).toHaveProperty("timestamp");
        expect(data[0]).toHaveProperty("session_id");
        expect(data[0]).toHaveProperty("query");
        expect(data[0]).toHaveProperty("skill_name");
        expect(data[0]).toHaveProperty("triggered");
      }
    });

    it("returns empty array for unknown skill", async () => {
      const res = await fetch(
        `http://localhost:${server.port}/api/evaluations/${encodeURIComponent("nonexistent-skill-xyz")}`,
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual([]);
    });

    it("includes CORS headers", async () => {
      const res = await fetch(
        `http://localhost:${server.port}/api/evaluations/${encodeURIComponent("test-skill")}`,
      );
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
    });
  });

  // ---- 404 for unknown routes ----
  describe("unknown routes", () => {
    it("returns 404 for unknown paths", async () => {
      const res = await fetch(`http://localhost:${server.port}/nonexistent`);
      expect(res.status).toBe(404);
    });
  });

  // ---- CORS headers ----
  describe("CORS", () => {
    it("includes CORS headers on API responses", async () => {
      const res = await fetch(`http://localhost:${server.port}/api/data`);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
    });
  });
});

// ---- Server lifecycle ----
describe("server lifecycle", () => {
  it("can start and stop cleanly", async () => {
    const s = await startDashboardServer({
      port: 0,
      host: "localhost",
      openBrowser: false,
      dataLoader: () => fakeData,
      statusLoader: () => ({
        skills: [],
        unmatchedQueries: 0,
        pendingProposals: 0,
        lastSession: null,
        system: { healthy: true, pass: 0, fail: 0, warn: 0 },
      }),
    });
    expect(s).toHaveProperty("stop");
    expect(s).toHaveProperty("port");
    expect(typeof s.port).toBe("number");
    expect(s.port).toBeGreaterThan(0);
    s.stop();
  });

  it("exposes port after binding", async () => {
    const s = await startDashboardServer({
      port: 0,
      host: "localhost",
      openBrowser: false,
      dataLoader: () => fakeData,
      statusLoader: () => ({
        skills: [],
        unmatchedQueries: 0,
        pendingProposals: 0,
        lastSession: null,
        system: { healthy: true, pass: 0, fail: 0, warn: 0 },
      }),
    });
    // Verify the server is actually responding
    const res = await fetch(`http://localhost:${s.port}/api/data`);
    expect(res.status).toBe(200);
    s.stop();
  });
});

describe("live shell loading", () => {
  let server: { server: unknown; stop: () => void; port: number };
  let dataLoaderCalls = 0;

  beforeAll(async () => {
    dataLoaderCalls = 0;
    server = await startDashboardServer({
      port: 0,
      host: "localhost",
      openBrowser: false,
      dataLoader: () => {
        dataLoaderCalls++;
        return {
          telemetry: [],
          skills: [],
          queries: [],
          evolution: [],
          evidence: [],
          decisions: [],
          computed: {
            snapshots: {},
            unmatched: [],
            pendingProposals: [],
          },
        };
      },
      statusLoader: () => ({
        skills: [],
        unmatchedQueries: 0,
        pendingProposals: 0,
        lastSession: null,
        system: {
          healthy: true,
          pass: 0,
          fail: 0,
          warn: 0,
        },
      }),
    });
  });

  afterAll(() => {
    server?.stop();
  });

  it("serves / without eagerly loading dashboard data", async () => {
    const res = await fetch(`http://localhost:${server.port}/`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain("__SELFTUNE_LIVE__");
    expect(html).not.toContain('id="embedded-data"');
    expect(dataLoaderCalls).toBe(0);
  });

  it("loads dashboard data only through /api/data", async () => {
    const res = await fetch(`http://localhost:${server.port}/api/data`);
    expect(res.status).toBe(200);
    expect(dataLoaderCalls).toBe(1);
  });
});
