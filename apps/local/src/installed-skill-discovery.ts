import type { Database } from "bun:sqlite";
import { realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { queryKnownWorkspacePaths } from "@selftune/runtime/localdb/queries";
import {
  extendSkillSearchDirsForWorkspaces,
  findInstalledSkillPackages,
  getDefaultSkillSearchDirs,
} from "@selftune/runtime/utils/skill-discovery";

export function installedSkillSearchDirs(database: Database): string[] {
  return extendSkillSearchDirsForWorkspaces(
    getDefaultSkillSearchDirs(),
    queryKnownWorkspacePaths(database),
  );
}

/** Prefer the requested registry, but preserve canonical symlink authorization. */
export function installedSkillPathsForSelection(
  database: Database,
  selectedPath: string,
): string[] {
  const original = resolve(selectedPath);
  const root = realpathSync(original);
  const isRequestedRegistry = (directory: string) =>
    directory === dirname(original) || directory === dirname(dirname(original));
  const matchingPath = (directories: readonly string[]) => {
    for (const directory of directories) {
      for (const skill of findInstalledSkillPackages([directory])) {
        try {
          if (realpathSync(skill.package_path) === root) return skill.package_path;
        } catch {
          // Disappearing and broken links cannot authorize a package.
        }
      }
    }
    return null;
  };
  const defaults = getDefaultSkillSearchDirs().filter(isRequestedRegistry);
  const direct = matchingPath(defaults);
  if (direct) return [direct];
  const directories = installedSkillSearchDirs(database).filter(
    (directory) => !defaults.includes(directory),
  );
  const preferred = directories.filter(
    (directory) => directory === dirname(original) || directory === dirname(dirname(original)),
  );
  const remaining = directories.filter((directory) => !preferred.includes(directory));
  const found = matchingPath([...preferred, ...remaining]);
  return found ? [found] : [];
}
