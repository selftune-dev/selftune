import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  HarnessPackageContribution,
  HarnessRuntimeContribution,
} from "@selftune/harness-core/descriptor";

export { openCodePresentation } from "./presentation.js";
import { openCodePresentation } from "./presentation.js";

export const openCodeRuntime: HarnessRuntimeContribution = {
  id: "opencode",
  detectConnection: ({ homeDir, which }) => {
    const configRoot = join(homeDir, ".config", "opencode");
    const pluginPath = join(configRoot, "plugins", "selftune-opencode-plugin.ts");
    const dataRoot = join(homeDir, ".local", "share", "opencode");
    const databasePath = join(dataRoot, "opencode.db");
    const legacySessionsPath = join(dataRoot, "storage", "session");
    const plugin = existsSync(pluginPath) ? readFileSync(pluginPath, "utf8") : "";
    const hooksInstalled = plugin.includes("selftune-managed") && plugin.includes("opencode hook");
    const importAvailable = existsSync(databasePath) || existsSync(legacySessionsPath);
    return {
      detected: existsSync(configRoot) || existsSync(databasePath) || Boolean(which("opencode")),
      connected: hooksInstalled || importAvailable,
      import_available: importAvailable,
      hooks_supported: true,
      hooks_installed: hooksInstalled,
      config_path: hooksInstalled ? pluginPath : databasePath,
      connected_detail: hooksInstalled ? "Live plugin connected" : "Session import available",
    };
  },
  sourceMerge: {
    invocation: (model) => ({ agent: "opencode", model: model?.trim() || undefined }),
  },
};

export const openCodeHarness: HarnessPackageContribution = {
  presentation: openCodePresentation,
  runtime: openCodeRuntime,
};
