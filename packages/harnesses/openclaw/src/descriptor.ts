import { existsSync } from "node:fs";
import { join } from "node:path";

import type {
  HarnessPackageContribution,
  HarnessRuntimeContribution,
} from "@selftune/harness-core/descriptor";

export { openClawPresentation } from "./presentation.js";
import { openClawPresentation } from "./presentation.js";

export const openClawRuntime: HarnessRuntimeContribution = {
  id: "openclaw",
  detectConnection: ({ homeDir, which }) => {
    const root = join(homeDir, ".openclaw");
    const sessionsPath = join(root, "agents");
    const importAvailable = existsSync(sessionsPath);
    return {
      detected: existsSync(root) || Boolean(which("openclaw")),
      connected: importAvailable,
      import_available: importAvailable,
      hooks_supported: false,
      hooks_installed: false,
      config_path: sessionsPath,
      connected_detail: "Session import available",
    };
  },
};

export const openClawHarness: HarnessPackageContribution = {
  presentation: openClawPresentation,
  runtime: openClawRuntime,
};
