import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

// The embedded mirror shares the monorepo install, where Storybook uses Vitest 4.
// Run the version qualified by the Effect adapter in either repository layout.
const require = createRequire(import.meta.resolve("@effect/vitest"));
const runner = join(dirname(require.resolve("vitest/package.json")), "vitest.mjs");
const result = spawnSync(process.execPath, [runner, "run", ...process.argv.slice(2)], {
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
