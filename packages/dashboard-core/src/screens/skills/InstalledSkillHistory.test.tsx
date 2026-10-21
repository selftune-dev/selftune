// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { DashboardHostProvider } from "../../host";
import { hostModules } from "../../test/host-modules";
import type { LibrarySkillModel } from "../../models";
import { InstalledSkillHistory } from "./InstalledSkillHistory";

afterEach(cleanup);
test("53 installed copies mount one history reader, switching without losing locations", () => {
  const modules = hostModules();
  modules.skills = {
    ...modules.skills,
    History: ({ skillPath }) => <p data-testid="history-reader">{skillPath}</p>,
  };
  const skill: LibrarySkillModel = {
    id: "test",
    name: "test",
    lifecycle: "active",
    status: "Ready",
    updateStatus: "untracked",
    sources: [],
    revisionHashes: [],
    locations: Array.from({ length: 53 }, (_, index) => ({
      id: String(index),
      label: "Global",
      path: `/agents/${index}/test`,
      sourceKind: "installed",
    })),
  };
  render(
    <DashboardHostProvider modules={modules}>
      <InstalledSkillHistory skill={skill} />
    </DashboardHostProvider>,
  );
  expect(screen.getAllByTestId("history-reader")).toHaveLength(1);
  expect(screen.getByTestId("history-reader").textContent).toBe("/agents/0/test/SKILL.md");
  expect(screen.getAllByRole("option")).toHaveLength(53);
  fireEvent.change(screen.getByLabelText("Installed copy history"), { target: { value: "52" } });
  expect(screen.getAllByTestId("history-reader")).toHaveLength(1);
  expect(screen.getByTestId("history-reader").textContent).toBe("/agents/52/test/SKILL.md");
});
