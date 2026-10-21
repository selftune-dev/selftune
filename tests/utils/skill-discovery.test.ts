import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import {
  classifySkillPath,
  findInstalledSkillPath,
  findInstalledSkillPaths,
} from "../../packages/runtime/utils/skill-discovery.js";

test("report path index preserves registry precedence, direct lookup, nested scopes, and links", () => {
  const root = mkdtempSync(join(tmpdir(), "skill-path-index-"));
  const dirs = [join(root, "first"), join(root, "second")];
  const create = (path: string) => {
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, "SKILL.md"), "# Skill\n");
  };
  try {
    create(join(dirs[0], "z-direct"));
    create(join(dirs[0], ".system", "z-direct"));
    create(join(dirs[0], ".system", "nested"));
    create(join(dirs[1], "nested"));
    create(join(dirs[1], "other"));
    symlinkSync(join(dirs[1], "other"), join(dirs[0], "linked"));
    symlinkSync(join(root, "missing"), join(dirs[0], "broken"));
    const names = ["z-direct", "Z-Direct", "nested", "linked", "other", "missing", "broken"];
    const paths = findInstalledSkillPaths(dirs, names);
    for (const name of names) {
      expect(paths.get(name)).toBe(findInstalledSkillPath(name, dirs));
    }
    expect(paths.get("z-direct")).toBe(realpathSync(join(dirs[0], "z-direct", "SKILL.md")));
    expect(paths.get("nested")).toBe(realpathSync(join(dirs[0], ".system", "nested", "SKILL.md")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("classifySkillPath", () => {
  test("classifies project, global, admin, system, and unknown skill paths", () => {
    const homeDir = "/tmp/selftune-home";
    const codexHome = "/tmp/selftune-codex";

    expect(
      classifySkillPath(
        "/tmp/workspace/my-repo/.agents/skills/selftune/SKILL.md",
        homeDir,
        codexHome,
      ),
    ).toEqual({
      skill_scope: "project",
      skill_project_root: "/tmp/workspace/my-repo",
      skill_registry_dir: "/tmp/workspace/my-repo/.agents/skills",
    });

    expect(
      classifySkillPath(
        join(homeDir, ".agents", "skills", "paperclip", "SKILL.md"),
        homeDir,
        codexHome,
      ),
    ).toEqual({
      skill_scope: "global",
      skill_registry_dir: join(homeDir, ".agents", "skills"),
    });

    expect(classifySkillPath("/etc/codex/skills/reins/SKILL.md", homeDir, codexHome)).toEqual({
      skill_scope: "admin",
      skill_registry_dir: "/etc/codex/skills",
    });

    expect(
      classifySkillPath(
        join(codexHome, "skills", ".system", "skill-installer", "SKILL.md"),
        homeDir,
        codexHome,
      ),
    ).toEqual({
      skill_scope: "system",
      skill_registry_dir: join(codexHome, "skills", ".system"),
    });

    expect(classifySkillPath("(codex:selftune)", homeDir, codexHome)).toEqual({
      skill_scope: "unknown",
    });
  });
});
