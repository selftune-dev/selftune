import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@selftune/ui/primitives", () => ({
  Tabs: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children?: ReactNode }) => <button>{children}</button>,
  TabsContent: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
  Tooltip: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children, render }: { children?: ReactNode; render?: ReactNode }) => (
    <div>
      {render}
      {children}
    </div>
  ),
  TooltipContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import { SkillReportTabs } from "./SkillReportTabs";

describe("SkillReportTabs", () => {
  it("renders only visible tabs and their content", () => {
    const html = renderToStaticMarkup(
      <SkillReportTabs
        defaultValue="evidence"
        tabs={[
          {
            value: "evidence",
            label: "Evidence",
            content: <div>Evidence body</div>,
          },
          {
            value: "invocations",
            label: "Invocations",
            content: <div>Invocations body</div>,
          },
          {
            value: "hidden",
            label: "Hidden",
            hidden: true,
            content: <div>Hidden body</div>,
          },
        ]}
      />,
    );

    expect(html).toContain("Evidence");
    expect(html).toContain("Invocations");
    expect(html).toContain("Evidence body");
    expect(html).toContain("Invocations body");
    expect(html).not.toContain("Hidden");
    expect(html).not.toContain("Hidden body");
  });

  it("renders tooltip and badge content when configured", () => {
    const html = renderToStaticMarkup(
      <SkillReportTabs
        defaultValue="invocations"
        tabs={[
          {
            value: "invocations",
            label: "Invocations",
            badge: <span>12</span>,
            tooltip: "Operational invocations only",
            content: <div>Invocations body</div>,
          },
        ]}
      />,
    );

    expect(html).toContain("Invocations");
    expect(html).toContain("12");
    expect(html).toContain("Operational invocations only");
  });
});
