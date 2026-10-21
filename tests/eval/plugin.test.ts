import { expect, test } from "bun:test";
import { pluginEvalArguments, type PluginEvalInput } from "../../packages/runtime/eval/plugin.js";

const input: PluginEvalInput = {
  target: "/tmp/plugin with spaces",
  runs: "3",
  threshold: "1",
  concurrency: "1",
  ablation: "with-without",
  trustPlugin: false,
  json: false,
};
test("native plugin evaluations remain local and do not imply trust or tool grants", () => {
  const args = pluginEvalArguments(input);
  expect(args.slice(0, 3)).toEqual(["plugin", "eval", input.target]);
  expect(args).toContain("--no-publish");
  expect(args).toContain("--no-scaffold");
  expect(args).not.toContain("--trust-plugin");
  expect(args).not.toContain("--allow-real-servers");
  expect(args).not.toContain("--allow-tools");
});
test("explicit options are passed as arguments, never shell text", () => {
  const args = pluginEvalArguments({
    ...input,
    trustPlugin: true,
    json: true,
    case: "a; echo nope",
    maxCostUsd: "0.25",
  });
  expect(args).toContain("a; echo nope");
  expect(args).toContain("--trust-plugin");
  expect(args.at(-1)).toBe("--json");
});
test("invalid numeric limits and option-like targets fail before execution", () => {
  for (const patch of [
    { runs: "0" },
    { runs: "2.5" },
    { threshold: "NaN" },
    { threshold: "1.1" },
    { concurrency: "9" },
    { maxCostUsd: "0" },
    { target: "--publish-report" },
  ]) {
    expect(() => pluginEvalArguments({ ...input, ...patch })).toThrow();
  }
});
