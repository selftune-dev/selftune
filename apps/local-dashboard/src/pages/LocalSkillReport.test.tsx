// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  DashboardHostProvider,
  type DashboardLibraryContribution,
} from "@selftune/dashboard-core/host";
import { LocalSkillReport } from "@selftune/dashboard-core/screens/skill-report";
import type { LibrarySkillModel } from "@selftune/dashboard-core/models";
import { localDashboardModules } from "../dashboard-host";

afterEach(cleanup);
const skill: LibrarySkillModel = {
  id: "marketing",
  name: "marketing",
  lifecycle: "active",
  status: "Ready",
  updateStatus: "current",
  sources: [{ kind: "github", label: "marketing-skills" }],
  revisionHashes: ["hash"],
  locations: [
    {
      id: "installed",
      label: "Global",
      path: "/skills/marketing",
      sourceKind: "installed",
      connection: "Codex",
      connectionIcon: { src: "/codex.svg", fit: "contain", inset: "sm" },
      removable: true,
    },
    {
      id: "backup",
      label: "Backup",
      path: "/archive/marketing",
      sourceKind: "archived",
      removable: false,
    },
  ],
  onDemandSource: {
    skillPath: "/skills/marketing/SKILL.md",
    packagePath: "/skills/marketing",
    contentHash: "hash",
  },
  contextEntries: [
    {
      harness: "codex",
      scope: "global",
      projectRoot: null,
      path: "/skills/marketing/SKILL.md",
      state: "active",
      metadata: {
        name: "marketing",
        description: "Write marketing campaigns.",
        disableModelInvocation: false,
        originalSkillPath: "/skills/marketing/SKILL.md",
      },
    },
  ],
};

function setup(error: string | null = null) {
  const execute = vi.fn().mockResolvedValue({ succeeded: 1, failed: 0, receipts: [] });
  const library: DashboardLibraryContribution = {
    access: "available",
    useInventory: () => ({
      data: error ? null : { skills: [skill], categoryOptions: [] },
      isLoading: false,
      error,
      refresh: vi.fn(),
    }),
    useActions: () => ({
      moveToLibraryMany: { access: "available", execute },
      updateCategory: { access: "unavailable", reason: "test" },
      openLocation: { access: "unavailable", reason: "test" },
      previewSourceUpdate: { access: "unavailable", reason: "test" },
      applySourceUpdate: { access: "unavailable", reason: "test" },
      mergeConnections: [],
      prepareMerge: { access: "unavailable", reason: "test" },
      applyMerge: { access: "unavailable", reason: "test" },
      archive: { access: "unavailable", reason: "test" },
      remove: { access: "unavailable", reason: "test" },
      decideRemoval: { access: "unavailable", reason: "test" },
      restore: { access: "unavailable", reason: "test" },
      create: { access: "unavailable", reason: "test" },
      primary: [],
    }),
  };
  render(
    <DashboardHostProvider
      modules={{ ...localDashboardModules, skills: { ...localDashboardModules.skills, library } }}
    >
      <LocalSkillReport
        name="marketing"
        backLink={<span>Skills</span>}
        checks={24}
        sessions={12}
        activity={() => <p>Recorded activity</p>}
        files={<p>Package viewer</p>}
        history={<p>Revision history</p>}
        testing={<p>Testing controls</p>}
        diagnostics={<p>Diagnostics</p>}
      />
    </DashboardHostProvider>,
  );
  return execute;
}

it("opens on local activity and navigates to files without mounting testing", () => {
  setup();
  expect(screen.getByText("Write marketing campaigns.")).toBeTruthy();
  expect(screen.getByText("Recorded activity")).toBeTruthy();
  expect(screen.queryByText("Testing controls")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "View files" }));
  expect(screen.getByRole("tabpanel", { name: "Files" }).textContent).toBe("Package viewer");
});

it("shows real installations and previews context before any movement", () => {
  const execute = setup();
  fireEvent.click(screen.getByRole("tab", { name: "Installations" }));
  expect(screen.getByText("/skills/marketing")).toBeTruthy();
  expect(screen.queryByText("/archive/marketing")).toBeNull();
  expect(document.querySelector('img[src="/codex.svg"]')).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Choose skills" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Keep marketing on demand" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText("Freed")).toBeTruthy();
  expect(dialog.getByText("1 skill will load only on request")).toBeTruthy();
  expect(execute).not.toHaveBeenCalled();
});

it("keeps history reachable when installation inventory fails", () => {
  setup("Inventory unavailable");
  expect(screen.getByRole("status").textContent).toBe("Inventory unavailable");
  fireEvent.click(screen.getByRole("tab", { name: "History" }));
  expect(screen.getByText("Revision history")).toBeTruthy();
});
