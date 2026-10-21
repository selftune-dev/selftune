import { claudeCodePresentation } from "../../claude-code/src/presentation.ts";
import { codexPresentation } from "../../codex/src/presentation.ts";
import { clinePresentation } from "../../cline/src/presentation.ts";
import { openCodePresentation } from "../../opencode/src/presentation.ts";
import { openClawPresentation } from "../../openclaw/src/presentation.ts";
import { piPresentation } from "../../pi/src/presentation.ts";

export const harnessPresentations = [
  claudeCodePresentation,
  codexPresentation,
  clinePresentation,
  openCodePresentation,
  openClawPresentation,
  piPresentation,
];
