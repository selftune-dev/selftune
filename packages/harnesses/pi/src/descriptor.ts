import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  HarnessPackageContribution,
  HarnessRuntimeContribution,
} from "@selftune/harness-core/descriptor";

const PI_HOOK_NAMES = ["tool_call", "tool_result", "message", "session_shutdown"] as const;

export { piPresentation } from "./presentation.js";
import { piPresentation } from "./presentation.js";

export const piRuntime: HarnessRuntimeContribution = {
  id: "pi",
  detectConnection: ({ homeDir, which }) => {
    const root = join(homeDir, ".pi");
    const extensionPath = join(root, "extensions", "selftune");
    const sessionsPath = join(root, "agent", "sessions");
    const hooksInstalled = PI_HOOK_NAMES.every((hookName) => {
      const hookPath = join(extensionPath, hookName);
      if (!existsSync(hookPath)) return false;
      const content = readFileSync(hookPath, "utf8");
      return content.includes("selftune-managed") && content.includes("pi hook");
    });
    const importAvailable = existsSync(sessionsPath);
    return {
      detected: existsSync(root) || Boolean(which("pi")),
      connected: hooksInstalled || importAvailable,
      import_available: importAvailable,
      hooks_supported: true,
      hooks_installed: hooksInstalled,
      config_path: hooksInstalled ? extensionPath : sessionsPath,
      connected_detail: hooksInstalled ? "Live hooks connected" : "Session import available",
    };
  },
  sourceMerge: {
    invocation: (model) => ({ agent: "pi", model: model?.trim() || undefined }),
  },
};

export const piHarness: HarnessPackageContribution = {
  presentation: piPresentation,
  runtime: piRuntime,
};
