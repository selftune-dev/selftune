import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sourceUpdateResources } from "@selftune/runtime/dashboard-reactivity";

import { createDashboardEventHub } from "../src/dashboard-events.js";

describe("DashboardEventHub", () => {
  test("bounded history replay does not disconnect a new subscriber as stalled", async () => {
    const root = mkdtempSync(join(tmpdir(), "selftune-sse-replay-"));
    const hub = createDashboardEventHub({
      databasePath: join(root, "db"),
      actionStreamPath: join(root, "actions"),
    });
    try {
      for (let i = 0; i < 200; i++)
        hub.broadcastAction({
          event_id: "replay",
          action: "eval-generate",
          stage: "stdout",
          skill_name: null,
          skill_path: null,
          ts: i,
          chunk: String(i),
        });
      const reader = hub.response().body?.getReader();
      hub.broadcastUpdate(sourceUpdateResources.apply);
      expect(hub.subscriberCount()).toBe(1);
      await reader?.read();
      const replay = new TextDecoder().decode((await reader?.read())?.value);
      expect(replay.match(/event: action/g)).toHaveLength(200);
      expect(new TextDecoder().decode((await reader?.read())?.value)).toContain("event: update");
      await reader?.cancel();
      expect(hub.subscriberCount()).toBe(0);
    } finally {
      hub.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });
  test("disconnects stalled subscribers instead of growing their queue indefinitely", () => {
    const root = mkdtempSync(join(tmpdir(), "selftune-sse-backpressure-"));
    const hub = createDashboardEventHub({
      databasePath: join(root, "db"),
      actionStreamPath: join(root, "actions"),
    });
    try {
      hub.response();
      expect(hub.subscriberCount()).toBe(1);
      for (let i = 0; i < 200; i += 1) hub.broadcastUpdate(sourceUpdateResources.apply);
      expect(hub.subscriberCount()).toBe(0);
    } finally {
      hub.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });
  test("broadcasts the semantic resources changed by a source update", async () => {
    const root = mkdtempSync(join(tmpdir(), "selftune-dashboard-events-"));
    const hub = createDashboardEventHub({
      databasePath: join(root, "selftune.db"),
      actionStreamPath: join(root, "actions.jsonl"),
    });
    const reader = hub.response().body?.getReader();

    try {
      expect(reader).toBeDefined();
      await reader?.read();

      hub.broadcastUpdate(sourceUpdateResources.apply);

      const update = await reader?.read();
      const payload = new TextDecoder().decode(update?.value);
      expect(payload).toContain("event: update");
      expect(payload).toContain(
        '"resources":["library-inventory","library-detail","skill-intelligence","overview"',
      );
      expect(payload).toContain('"source-update"');
      expect(payload).toContain('"projects"');
    } finally {
      await reader?.cancel();
      expect(hub.subscriberCount()).toBe(0);
      hub.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
