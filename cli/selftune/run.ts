import { PUBLIC_COMMAND_SURFACES, renderCommandHelp } from "./command-surface.js";
import { cliMain as orchestrateCliMain } from "./orchestrate.js";
import { handleCLIError } from "./utils/cli-error.js";

export async function cliMain(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    console.log(renderCommandHelp(PUBLIC_COMMAND_SURFACES.run));
    process.exit(0);
  }

  await orchestrateCliMain();
}

if (import.meta.main) {
  cliMain().catch(handleCLIError);
}
