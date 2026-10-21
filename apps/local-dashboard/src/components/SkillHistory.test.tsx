// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SkillHistory } from "./SkillHistory";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows comparisons and requires confirmation before restoring with the reviewed hash", async () => {
  const revision = (number: number) => ({
    package_path: "/skills/brand",
    revision: number,
    content_hash: `hash-${number}`,
    captured_at: "2026-09-08T08:00:00Z",
    reason: "observed",
    restored_from: null,
  });
  const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
    if (init?.method === "POST") return Response.json(revision(3));
    if (input.includes("revision="))
      return Response.json({
        files: [
          {
            path: "SKILL.md",
            change: "added",
            before: null,
            after: "Approved brand voice",
            beforeMode: null,
            afterMode: 420,
          },
        ],
      });
    return Response.json({ revisions: [revision(2), revision(1)] });
  });
  vi.stubGlobal("fetch", fetcher);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SkillHistory skillPath="/skills/brand/SKILL.md" />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: /Revision 1 ·/ }));
  expect(await screen.findByText("Approved brand voice")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Restore revision 1" }));
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Confirm restore" }));
  await waitFor(() =>
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1),
  );
  expect(fetcher.mock.calls.find(([, init]) => init?.method === "POST")?.[1]?.body).toBe(
    JSON.stringify({ path: "/skills/brand", revision: 1, expectedHash: "hash-2" }),
  );
  client.clear();
});
