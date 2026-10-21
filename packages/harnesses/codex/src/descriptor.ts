import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as Schema from "effect/Schema";
import { CodexHooksFile } from "./adapters/codex/hooks-config.js";

import type {
  HarnessPackageContribution,
  HarnessRuntimeContribution,
} from "@selftune/harness-core/descriptor";

export function hasCodexHooksAt(path: string): boolean {
  try {
    const { hooks } = Schema.decodeUnknownSync(Schema.fromJsonString(CodexHooksFile))(
      readFileSync(path, "utf8"),
    );
    return ["SessionStart", "PreToolUse", "PostToolUse", "Stop"].every(
      (event) =>
        hooks?.[event]?.some((group) =>
          group.hooks.some((handler) => {
            const command = handler.command;
            return (
              command !== undefined &&
              command.includes("codex hook") &&
              command.includes("selftune")
            );
          }),
        ) === true,
    );
  } catch {
    return false;
  }
}

export { codexPresentation } from "./presentation.js";
import { codexPresentation } from "./presentation.js";

export const codexRuntime: HarnessRuntimeContribution = {
  id: "codex",
  detectConnection: ({ homeDir, which }) => {
    const root = process.env.CODEX_HOME || join(homeDir, ".codex");
    const hooksPath = join(root, "hooks.json");
    const sessionsPath = join(root, "sessions");
    const hooksInstalled = hasCodexHooksAt(hooksPath);
    const importAvailable = existsSync(sessionsPath);
    return {
      detected: existsSync(root) || Boolean(which("codex")),
      connected: hooksInstalled || importAvailable,
      import_available: importAvailable,
      hooks_supported: true,
      hooks_installed: hooksInstalled,
      config_path: hooksInstalled ? hooksPath : sessionsPath,
      connected_detail: hooksInstalled ? "Live hooks connected" : "Session import available",
    };
  },
  sourceMerge: {
    invocation: (model) => ({ agent: "codex", model: model?.trim() || undefined }),
  },
};

export const codexHarness: HarnessPackageContribution = {
  presentation: codexPresentation,
  runtime: codexRuntime,
};
