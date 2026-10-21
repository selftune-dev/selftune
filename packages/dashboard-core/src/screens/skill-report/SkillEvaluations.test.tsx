// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { EvaluationHistory } from "@selftune/control-plane/domain/evaluation-report";
import { SkillEvaluations } from "./SkillEvaluations";

afterEach(cleanup);
const history: EvaluationHistory = [
  {
    id: "one",
    importedAt: "2026-09-12T09:00:00Z",
    result: {
      engine: "selftune-skill",
      harness: "codex",
      model: "test-model",
      recordedAt: null,
      threshold: 0.8,
      exitCode: 0,
      cases: [
        {
          name: "Completes task",
          score: 1,
          baseline: 0.5,
          delta: 0.5,
          incomplete: false,
          errors: [],
          prompt: "Review the change",
          assertions: [
            {
              arm: "with",
              name: "Used skill",
              passed: true,
              scored: false,
              evidence: "Invocation indicator",
            },
          ],
        },
      ],
    },
  },
];
test("uses shared harness icons and reveals unscored assertion evidence", () => {
  render(
    <SkillEvaluations
      history={history}
      harnesses={[
        { id: "codex", name: "Codex", icon: { src: "/codex.svg", fit: "contain", inset: "none" } },
      ]}
      busy={false}
      onImport={vi.fn()}
    />,
  );
  expect(screen.getAllByText("+50 pp")).toHaveLength(2);
  expect(screen.getByTitle("Codex").getAttribute("src")).toBe("/codex.svg");
  fireEvent.click(screen.getByText("Completes task"));
  expect(screen.getByText("Not scored")).toBeTruthy();
  expect(screen.getByText("Invocation indicator")).toBeTruthy();
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
});
test("paginates large suites and does not summarize incomplete results as successes", () => {
  const source = history[0];
  if (!source) throw new Error("Missing fixture");
  const entry = source.result.cases[0];
  if (!entry) throw new Error("Missing case fixture");
  render(
    <SkillEvaluations
      history={[
        {
          ...source,
          result: {
            ...source.result,
            exitCode: 2,
            cases: Array.from({ length: 25 }, (_, i) => ({
              ...entry,
              name: `Case ${i + 1}`,
              incomplete: i === 24,
            })),
          },
        },
      ]}
      harnesses={[]}
      busy={false}
      onImport={vi.fn()}
    />,
  );
  expect(screen.queryByRole("button", { name: "Case 25" })).toBeNull();
  expect(screen.getByLabelText("Run summary").textContent).toContain("24 / 25");
  expect(screen.getByLabelText("Run summary").textContent).not.toContain("100%");
  fireEvent.click(screen.getByRole("button", { name: "Next", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Case 25", exact: true }));
  expect(screen.getByRole("dialog").textContent).toContain("Incomplete");
});
test("does not fabricate results in the empty or error states", () => {
  render(
    <SkillEvaluations
      history={[]}
      harnesses={[]}
      busy={false}
      error="Malformed report"
      onImport={vi.fn()}
    />,
  );
  expect(screen.getByText("No evaluation runs yet")).toBeTruthy();
  expect(screen.getByText("Malformed report")).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
});
