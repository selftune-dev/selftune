import type { Database } from "bun:sqlite";
import {
  constants,
  lstatSync,
  openSync,
  closeSync,
  readSync,
  fstatSync,
  opendirSync,
  realpathSync,
} from "node:fs";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";
import { installedSkillPathsForSelection } from "./installed-skill-discovery.js";

const MAX_ENTRIES = 2000;
const MAX_PREVIEW_BYTES = 256 * 1024;

export function createSkillPackageInspector(
  installedPaths: (selectedPath: string) => readonly string[],
) {
  function rootFor(skillPath: string) {
    const root = realpathSync(dirname(skillPath));
    const installed = installedPaths(dirname(skillPath)).some((path) => {
      try {
        return realpathSync(path) === root;
      } catch {
        return false;
      }
    });
    if (!installed) throw new Error("Select an installed skill package.");
    return root;
  }
  return (request: Request, url: URL): Response | null => {
    if (url.pathname !== "/api/v2/skill-package") return null;
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
    try {
      const skillPath = url.searchParams.get("skillPath");
      if (!skillPath) throw new Error("Select a skill package.");
      const root = rootFor(skillPath);
      const file = url.searchParams.get("file");
      if (file !== null) {
        if (
          !file ||
          isAbsolute(file) ||
          file
            .split(/[\\/]/)
            .some(
              (part) =>
                !part ||
                part === "." ||
                part === ".." ||
                part === ".git" ||
                part === "node_modules",
            )
        )
          throw new Error("Invalid package-relative file path.");
        const target = resolve(root, file);
        if (relative(root, target).startsWith("..") || isAbsolute(relative(root, target)))
          throw new Error("File is outside the skill package.");
        let current = root;
        for (const part of file.split("/")) {
          current = join(current, part);
          if (lstatSync(current).isSymbolicLink())
            return Response.json({ path: file, size: 0, content: null, reason: "symlink" });
        }
        const descriptor = openSync(
          target,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        try {
          const stat = fstatSync(descriptor);
          if (!stat.isFile()) throw new Error("Select a regular file.");
          if (stat.size > MAX_PREVIEW_BYTES)
            return Response.json({
              path: file,
              size: stat.size,
              content: null,
              reason: "too_large",
            });
          const bytes = Buffer.alloc(MAX_PREVIEW_BYTES + 1);
          let length = 0;
          while (length < bytes.length) {
            const count = readSync(descriptor, bytes, length, bytes.length - length, null);
            if (!count) break;
            length += count;
          }
          if (length > MAX_PREVIEW_BYTES)
            return Response.json({ path: file, size: length, content: null, reason: "too_large" });
          const body = bytes.subarray(0, length);
          let content: string | null = null;
          if (!body.includes(0)) {
            try {
              content = new TextDecoder("utf-8", { fatal: true }).decode(body);
            } catch {
              /* Binary data has no text preview. */
            }
          }
          return Response.json({
            path: file,
            size: length,
            content,
            reason: content === null ? "binary" : null,
          });
        } finally {
          closeSync(descriptor);
        }
      }
      const files: { path: string; size: number; symlink: boolean }[] = [];
      let visited = 0;
      let limited = false;
      function walk(directory: string, depth: number) {
        if (depth > 20) {
          limited = true;
          return;
        }
        const dir = opendirSync(directory);
        try {
          while (true) {
            const entry = dir.readSync();
            if (!entry) break;
            if (++visited > MAX_ENTRIES) {
              limited = true;
              return;
            }
            if (entry.name === ".git" || entry.name === "node_modules") continue;
            const path = join(directory, entry.name);
            if (entry.isSymbolicLink())
              files.push({ path: relative(root, path), size: 0, symlink: true });
            else if (entry.isDirectory()) walk(path, depth + 1);
            else if (entry.isFile())
              files.push({
                path: relative(root, path),
                size: lstatSync(path).size,
                symlink: false,
              });
            if (limited && visited > MAX_ENTRIES) return;
          }
        } finally {
          dir.closeSync();
        }
      }
      walk(root, 0);
      files.sort((a, b) => a.path.localeCompare(b.path));
      return Response.json({ files, limited });
    } catch {
      return Response.json(
        {
          error:
            "This file or installed skill package is no longer available, or its path is not allowed.",
        },
        { status: 400 },
      );
    }
  };
}

export function installedSkillPackageInspector(database: Database) {
  return createSkillPackageInspector((path) => installedSkillPathsForSelection(database, path));
}
