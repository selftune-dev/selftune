import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  type HarnessPackageContribution,
  type HarnessRuntimeContribution,
} from "@selftune/harness-core/descriptor";

const CLINE_HOOK_NAMES = ["PostToolUse", "TaskComplete", "TaskCancel"] as const;
// Official product mark from https://github.com/cline/cline/blob/main/assets/icons/icon.png.

export { clinePresentation } from "./presentation.js";
import { clinePresentation } from "./presentation.js";

export const clineRuntime: HarnessRuntimeContribution = {
  id: "cline",
  detectConnection: ({ homeDir, which }) => {
    const root = join(homeDir, "Documents", "Cline");
    const hooksPath = join(root, "Hooks");
    const hooksInstalled = CLINE_HOOK_NAMES.every((hookName) => {
      const hookPath = join(hooksPath, hookName);
      return existsSync(hookPath) && readFileSync(hookPath, "utf8").includes("selftune-managed");
    });
    return {
      detected: existsSync(root) || Boolean(which("cline")),
      connected: hooksInstalled,
      import_available: false,
      hooks_supported: true,
      hooks_installed: hooksInstalled,
      config_path: hooksPath,
      connected_detail: "Live hooks connected",
    };
  },
};

export const clineHarness: HarnessPackageContribution = {
  presentation: clinePresentation,
  runtime: clineRuntime,
};
