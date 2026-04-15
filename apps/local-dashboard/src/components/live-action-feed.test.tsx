import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const entry = {
  id: "evt-live-1",
  action: "measure-baseline" as const,
  skillName: "Taxes",
  skillPath: "/tmp/Taxes/SKILL.md",
  status: "running" as const,
  startedAt: Date.parse("2026-04-15T10:00:00.000Z"),
  updatedAt: Date.parse("2026-04-15T10:01:00.000Z"),
  output: ["Replaying package evals"],
  logs: [],
  error: null,
  exitCode: null,
  summary: null,
  metrics: null,
  progress: null,
};

vi.mock("lucide-react", () => ({
  __esModule: true,
  Activity: () => null,
  ArrowRight: () => null,
  Loader2: () => null,
  default: {
    Activity: () => null,
    ArrowRight: () => null,
    Loader2: () => null,
  },
}));

vi.mock("@selftune/ui/lib", () => ({
  timeAgo: () => "just now",
}));

vi.mock("@selftune/ui/primitives", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Card: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardHeader: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardTitle: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/live-action-feed", () => ({
  formatActionLabel: () => "Measure baseline",
  useLiveActionFeed: () => [entry],
}));

describe("LiveActionFeed", () => {
  it("links live lifecycle entries to the exact live run", async () => {
    const { LiveActionFeed } = await import("./live-action-feed");
    const html = renderToStaticMarkup(<LiveActionFeed />);

    expect(html).toContain(
      'href="/live-run?event=evt-live-1&amp;action=measure-baseline&amp;skill=Taxes"',
    );
    expect(html).toContain("Live lifecycle actions");
    expect(html).toContain("Measure baseline");
    expect(html).toContain("Live run");
    expect(html).toContain("Replaying package evals");
  });
});
