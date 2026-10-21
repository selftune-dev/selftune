// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SkillPackageViewer } from "@selftune/ui/components";

afterEach(cleanup);
describe("package Markdown inspection", () => {
  it("renders Markdown by default, exposes source, and opens package-relative links", () => {
    const onSelect = vi.fn();
    const content =
      "---\nname: example\n---\n# Package guide\n\nRead [reference](references/guide.md).";
    render(
      <SkillPackageViewer
        paths={["SKILL.md", "references/guide.md"]}
        selectedPath="SKILL.md"
        content={content}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole("heading", { name: "Package guide" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "reference" }));
    expect(onSelect).toHaveBeenCalledWith("references/guide.md");
    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    expect(screen.queryByRole("heading", { name: "Package guide" })).toBeNull();
    expect(screen.getByLabelText("File content").querySelector("diffs-container")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByRole("heading", { name: "Package guide" })).not.toBeNull();
  });
  it("does not execute HTML or load remote images", () => {
    const { container } = render(
      <SkillPackageViewer
        paths={["SKILL.md"]}
        selectedPath="SKILL.md"
        content={
          "# Safe\n\n<script>alert(1)</script>\n\n![tracker](https://example.com/pixel.png)\n\n[bad](javascript:alert(1))"
        }
        onSelect={vi.fn()}
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[href^="javascript:"]')).toBeNull();
    expect(screen.getByText(/not loaded in preview/)).not.toBeNull();
  });
});
