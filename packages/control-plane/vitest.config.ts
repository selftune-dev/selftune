import { defineConfig } from "vitest/config";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const effectRequire = createRequire(import.meta.resolve("@effect/vitest"));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^vitest$/,
        replacement: join(dirname(effectRequire.resolve("vitest/package.json")), "dist/index.js"),
      },
    ],
  },
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
