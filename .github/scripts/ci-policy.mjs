import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const desktopTargets = [
  {
    os: "macos-15",
    platform: "mac",
    target: "bun-darwin-arm64",
    package_script: "package:mac",
    arch_flag: "--arm64",
    artifact: "selftune-desktop-macos-arm64",
  },
  {
    os: "macos-15-intel",
    platform: "mac",
    target: "bun-darwin-x64",
    package_script: "package:mac",
    arch_flag: "--x64",
    artifact: "selftune-desktop-macos-x64",
  },
  {
    os: "ubuntu-latest",
    platform: "linux",
    target: "bun-linux-x64",
    package_script: "package:linux",
    arch_flag: "--x64",
    artifact: "selftune-desktop-linux-x64",
  },
  {
    os: "windows-latest",
    platform: "win",
    target: "bun-windows-x64",
    package_script: "package:win",
    arch_flag: "--x64",
    artifact: "selftune-desktop-windows-x64",
  },
];

export function isDocsOnly(paths) {
  return (
    paths.length > 0 && paths.every((path) => path.endsWith(".md") || path.startsWith("docs/"))
  );
}

export function selectPolicy(eventName, paths) {
  return {
    run_heavy: eventName !== "pull_request" || !isDocsOnly(paths),
    desktop_matrix: {
      include: desktopTargets.filter(
        (target) => eventName !== "pull_request" || target.platform !== "mac",
      ),
    },
  };
}

export function changedPaths(event, cwd = process.cwd()) {
  const base = event.pull_request?.base?.sha;
  if (!/^[a-f0-9]{40}$/i.test(base ?? "")) throw new Error("Expected a full PR base commit SHA");
  return execFileSync("git", ["diff", "--name-only", "--no-renames", "-z", base, "HEAD"], {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  })
    .split("\0")
    .filter(Boolean);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const eventName = process.env.GITHUB_EVENT_NAME;
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const policy = selectPolicy(eventName, eventName === "pull_request" ? changedPaths(event) : []);
  const output = `run_heavy=${policy.run_heavy}\ndesktop_matrix=${JSON.stringify(policy.desktop_matrix)}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
  process.stdout.write(output);
}
