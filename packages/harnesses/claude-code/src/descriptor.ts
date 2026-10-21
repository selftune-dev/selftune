import { Schema } from "effect";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  HarnessPackageContribution,
  HarnessRuntimeContribution,
} from "@selftune/harness-core/descriptor";
import { ClaudeCodeSettings, missingClaudeCodeHookKeys } from "@selftune/runtime/utils/hooks";

function readHooks(path: string): NonNullable<ClaudeCodeSettings["hooks"]> | null {
  try {
    return (
      Schema.decodeUnknownSync(Schema.fromJsonString(ClaudeCodeSettings))(
        readFileSync(path, "utf8"),
      ).hooks ?? null
    );
  } catch {
    return null;
  }
}

export { claudeCodePresentation } from "./presentation.js";
import { claudeCodePresentation } from "./presentation.js";

export const claudeCodeRuntime: HarnessRuntimeContribution = {
  id: "claude_code",
  detectConnection: ({ homeDir, which }) => {
    const root = join(homeDir, ".claude");
    const configPath = join(root, "settings.json");
    const projectsPath = join(root, "projects");
    const hooks = readHooks(configPath);
    const hooksInstalled = hooks !== null && missingClaudeCodeHookKeys(hooks).length === 0;
    return {
      detected: existsSync(root) || Boolean(which("claude")),
      connected: hooksInstalled,
      import_available: existsSync(projectsPath),
      hooks_supported: true,
      hooks_installed: hooksInstalled,
      config_path: configPath,
      connected_detail: "Live hooks connected",
    };
  },
  sourceMerge: {
    invocation: (model) => ({ agent: "claude", model: model?.trim() || undefined }),
  },
};

export const claudeCodeHarness: HarnessPackageContribution = {
  presentation: claudeCodePresentation,
  runtime: claudeCodeRuntime,
};
