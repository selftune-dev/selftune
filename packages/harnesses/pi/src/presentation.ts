import type { HarnessPresentation } from "@selftune/harness-core/descriptor";
import { svgHarnessIcon } from "@selftune/harness-core/descriptor";

export const piPresentation: HarnessPresentation = {
  id: "pi",
  name: "Pi",
  description: "Pi coding agent with extension hooks and session import.",
  icon: svgHarnessIcon(
    '<svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="40" rx="4" fill="#1a1a2e"/><text x="16" y="28" font-family="serif" font-size="24" font-weight="bold" fill="#e0e0e0" text-anchor="middle">π</text></svg>\n',
    { fit: "contain", inset: "none" },
  ),
  documentation_url: "https://docs.selftune.dev/guides/platform-hooks",
};
