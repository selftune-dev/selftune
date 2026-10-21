import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleEvaluations } from "../src/routes/evaluations.js";

test("evaluation imports persist, deduplicate, remain skill-scoped, and reject malformed reports", async () => {
  const root = mkdtempSync(join(tmpdir(), "evaluation-routes-"));
  const url = new URL("http://localhost/api/v2/evaluations?skill=example");
  const raw = JSON.stringify({
    skill_name: "example",
    agent: "codex",
    threshold: 0.8,
    baseline: "without_skill",
    cases: [
      {
        id: 1,
        with_skill_pass_rate: 0.8,
        baseline_pass_rate: 0,
        with_skill_assertions: [
          {
            text: "Correct result",
            passed: true,
            scored: true,
            evidence: "Produced the requested output",
          },
        ],
      },
    ],
  });
  const send = (body: string) =>
    handleEvaluations(
      new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body }),
      url,
      root,
    );
  try {
    expect((await send(raw)).status).toBe(200);
    const imported = await (await send(raw)).json();
    expect(imported).toHaveLength(1);
    expect(imported[0].result.harness).toBe("codex");
    expect(imported[0].result.threshold).toBe(0.8);
    expect(imported[0].result.exitCode).toBe(0);
    expect(imported[0].result.cases[0].assertions[0].evidence).toBe(
      "Produced the requested output",
    );
    const other = new URL("http://localhost/api/v2/evaluations?skill=other");
    expect(await (await handleEvaluations(new Request(other), other, root)).json()).toEqual([]);
    expect((await send("{}")).status).toBe(400);
    expect((await send("x".repeat(2 * 1024 * 1024 + 1))).status).toBe(413);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
