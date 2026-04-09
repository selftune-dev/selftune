import { describe, expect, mock, test } from "bun:test";

import {
  createReplayUnavailableError,
  runValidationContract,
} from "../../cli/selftune/evolution/validation-contract.js";
import type { EvalEntry, RoutingReplayFixture } from "../../cli/selftune/types.js";

const evalSet: EvalEntry[] = [{ query: "improve my slides", should_trigger: true }];

const replayFixture: RoutingReplayFixture = {
  fixture_id: "fixture-test",
  platform: "codex",
  target_skill_name: "slides",
  target_skill_path: "/tmp/slides/SKILL.md",
  competing_skill_paths: [],
};

describe("validation-contract", () => {
  test("judge mode bypasses replay and returns judge result", async () => {
    const runJudge = mock(async () => ({
      result: { engine: "judge", improved: false },
      modeUsed: "llm_judge" as const,
    }));
    const replayRunner = mock(async () => [
      {
        query: evalSet[0]!.query,
        should_trigger: true,
        triggered: true,
        passed: true,
      },
    ]);

    const result = await runValidationContract({
      mode: "judge",
      originalContent: "before",
      proposedContent: "after",
      evalSet,
      agent: "claude",
      replayOptions: { replayFixture, replayRunner },
      runJudge,
      adaptReplayResult: () => ({ engine: "replay", improved: true }),
    });

    expect(result).toEqual({
      result: { engine: "judge", improved: false },
      modeUsed: "llm_judge",
    });
    expect(runJudge).toHaveBeenCalledTimes(1);
    expect(replayRunner).toHaveBeenCalledTimes(0);
  });

  test("auto mode prefers replay when replay is available", async () => {
    const runJudge = mock(async () => ({
      result: { engine: "judge", improved: false },
      modeUsed: "llm_judge" as const,
    }));
    const replayRunner = mock(async ({ routing }: { routing: string }) => [
      {
        query: evalSet[0]!.query,
        should_trigger: true,
        triggered: routing === "after",
        passed: routing === "after",
      },
    ]);

    const result = await runValidationContract({
      mode: "auto",
      originalContent: "before",
      proposedContent: "after",
      evalSet,
      agent: "claude",
      replayOptions: { replayFixture, replayRunner },
      runJudge,
      adaptReplayResult: (replayResult) => ({
        engine: "replay",
        improved: replayResult.improved,
        after: replayResult.after_pass_rate,
      }),
    });

    expect(result).toEqual({
      result: { engine: "replay", improved: true, after: 1 },
      modeUsed: "host_replay",
    });
    expect(runJudge).toHaveBeenCalledTimes(0);
    expect(replayRunner).toHaveBeenCalledTimes(2);
  });

  test("auto mode falls back to judge and invokes fallback hook", async () => {
    const runJudge = mock(async () => ({
      result: { engine: "judge", improved: false },
      modeUsed: "llm_judge" as const,
    }));
    const onReplayFallback = mock(() => {});

    const result = await runValidationContract({
      mode: "auto",
      originalContent: "before",
      proposedContent: "after",
      evalSet,
      agent: "claude",
      runJudge,
      adaptReplayResult: () => ({ engine: "replay", improved: true }),
      onReplayFallback,
    });

    expect(result).toEqual({
      result: { engine: "judge", improved: false },
      modeUsed: "llm_judge",
    });
    expect(runJudge).toHaveBeenCalledTimes(1);
    expect(onReplayFallback).toHaveBeenCalledTimes(1);
  });

  test("replay mode throws a targeted unavailable error when replay cannot run", async () => {
    const runJudge = mock(async () => ({
      result: { engine: "judge", improved: false },
      modeUsed: "llm_judge" as const,
    }));

    await expect(
      runValidationContract({
        mode: "replay",
        originalContent: "before",
        proposedContent: "after",
        evalSet,
        agent: "claude",
        runJudge,
        adaptReplayResult: () => ({ engine: "replay", improved: true }),
      }),
    ).rejects.toMatchObject({
      message: createReplayUnavailableError().message,
      code: "REPLAY_UNAVAILABLE",
    });
    expect(runJudge).toHaveBeenCalledTimes(0);
  });
});
