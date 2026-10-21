import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSkillPackageInspector } from "../src/skill-package-inspector";

const fixtures: string[] = [];
afterEach(() => {
  for (const path of fixtures.splice(0)) rmSync(path, { recursive: true, force: true });
});
function fixture() {
  const parent = mkdtempSync(join(tmpdir(), "selftune-package-inspector-"));
  fixtures.push(parent);
  const root = join(parent, "skill");
  mkdirSync(root);
  writeFileSync(join(root, "SKILL.md"), "# Useful skill\n\nRead [the guide](references/guide.md).");
  mkdirSync(join(root, "references"));
  writeFileSync(join(root, "references/guide.md"), "## Guide\nActual package text.");
  const handler = createSkillPackageInspector(() => [root]);
  const request = (file?: string, skillPath = join(root, "SKILL.md"), method = "GET") => {
    const url = new URL("http://localhost/api/v2/skill-package");
    url.searchParams.set("skillPath", skillPath);
    if (file !== undefined) url.searchParams.set("file", file);
    const response = handler(new Request(url, { method }), url);
    if (!response) throw new Error("Expected package route");
    return response;
  };
  return { root, parent, request };
}
describe("read-only installed package inspector", () => {
  it("lists nested files and returns exact Markdown and source", async () => {
    const { request } = fixture();
    expect((await request().json()).files.map((file: { path: string }) => file.path)).toEqual([
      "references/guide.md",
      "SKILL.md",
    ]);
    expect(await request("references/guide.md").json()).toMatchObject({
      content: "## Guide\nActual package text.",
      reason: null,
    });
  });
  it("rejects traversal, absolute paths, unknown roots and writes", async () => {
    const { request, parent } = fixture();
    expect(request("../secret").status).toBe(400);
    expect(request("/etc/passwd").status).toBe(400);
    expect(request(undefined, join(parent, "SKILL.md")).status).toBe(400);
    expect(request(undefined, undefined, "POST").status).toBe(405);
  });
  it("does not follow symlink files or directories", async () => {
    const { request, root, parent } = fixture();
    writeFileSync(join(parent, "secret"), "private");
    symlinkSync(join(parent, "secret"), join(root, "linked"));
    symlinkSync(parent, join(root, "outside"));
    expect(await request("linked").json()).toMatchObject({ content: null, reason: "symlink" });
    expect(await request("outside/secret").json()).toMatchObject({
      content: null,
      reason: "symlink",
    });
    expect(
      (await request().json()).files.some(
        (file: { path: string }) => file.path === "outside/secret",
      ),
    ).toBe(false);
  });
  it("bounds previews and identifies binary and empty files", async () => {
    const { request, root } = fixture();
    writeFileSync(join(root, "large.txt"), "x".repeat(256 * 1024 + 1));
    writeFileSync(join(root, "binary.dat"), Buffer.from([0, 255]));
    writeFileSync(join(root, "empty.txt"), "");
    expect(await request("large.txt").json()).toMatchObject({ reason: "too_large", content: null });
    expect(await request("binary.dat").json()).toMatchObject({ reason: "binary", content: null });
    expect(await request("empty.txt").json()).toMatchObject({ reason: null, content: "" });
  });
});
