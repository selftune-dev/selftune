import { describe, expect, it } from "bun:test";

import {
  backgroundServiceResourceDirectory,
  buildBackgroundServiceArgs,
  parseBackgroundServiceResponse,
} from "./background-service";

const options = {
  executablePath: "/Applications/SelfTune.app/Contents/Resources/selftune/selftune",
  resourceDir: "/Applications/SelfTune.app/Contents/Resources/selftune",
  configDir: "/Users/test/.selftune",
  version: "0.3.0",
};

describe("background service CLI adapter", () => {
  const directories = {
    resourcesPath: "/Applications/SelfTune.app/Contents/Resources",
    installedRuntimeDirectory: "/Users/test/Library/Application Support/SelfTune/runtime/0.5.3",
  };

  it("keeps an installed macOS service inside its signed app bundle across updates", () => {
    expect(
      backgroundServiceResourceDirectory({
        ...directories,
        platform: "darwin",
        inApplicationsFolder: true,
      }),
    ).toBe("/Applications/SelfTune.app/Contents/Resources/selftune");
  });

  it("retains extracted runtimes for temporary Mac apps and other platforms", () => {
    for (const platform of ["darwin", "linux", "win32"] satisfies NodeJS.Platform[]) {
      expect(
        backgroundServiceResourceDirectory({
          ...directories,
          platform,
          inApplicationsFolder: false,
        }),
      ).toBe(directories.installedRuntimeDirectory);
    }
  });

  it("delegates installation to the single bundled SelfTune runtime", () => {
    expect(buildBackgroundServiceArgs(options, "install")).toEqual([
      "service",
      "install",
      "--json",
      "--port",
      "7888",
      "--config-dir",
      "/Users/test/.selftune",
      "--executable",
      "/Applications/SelfTune.app/Contents/Resources/selftune/selftune",
      "--resource-dir",
      "/Applications/SelfTune.app/Contents/Resources/selftune",
      "--owner",
      "desktop",
      "--service-version",
      "0.3.0",
    ]);
  });

  it("decodes the machine-readable service response", () => {
    expect(
      parseBackgroundServiceResponse(
        `${JSON.stringify({
          ok: true,
          action: "status",
          status: {
            platform: "darwin",
            registered: true,
            running: true,
            pid: 42,
            detail: ["Serving http://127.0.0.1:7888."],
          },
        })}\n`,
      ),
    ).toEqual({
      platform: "darwin",
      registered: true,
      running: true,
      pid: 42,
      detail: ["Serving http://127.0.0.1:7888."],
    });
  });
});
