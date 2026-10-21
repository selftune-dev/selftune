import { expect, test } from "bun:test";
import {
  closeSync,
  mkdtempSync,
  openSync,
  rmSync,
  symlinkSync,
  ftruncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MAX_RECONSTRUCTION_BYTES,
  readBoundedSource,
} from "@selftune/observability/source-reconstruction";

test("source reads enforce their byte budget and distinguish missing, unsafe and available files", async () => {
  const directory = mkdtempSync(join(tmpdir(), "selftune-bounded-source-"));
  try {
    const path = join(directory, "source.jsonl");
    expect(await readBoundedSource(path)).toEqual({
      state: "unavailable",
      reason: "source_missing",
    });
    writeFileSync(path, "fixture source");
    const result = await readBoundedSource(path);
    expect(result.state === "available" && result.bytes.toString()).toBe("fixture source");
    const link = join(directory, "symlink");
    symlinkSync(path, link);
    expect(await readBoundedSource(link)).toEqual({
      state: "unavailable",
      reason: "source_unavailable",
    });
    expect(await readBoundedSource(directory)).toEqual({
      state: "unavailable",
      reason: "source_unavailable",
    });
    const fd = openSync(path, "r+");
    try {
      ftruncateSync(fd, MAX_RECONSTRUCTION_BYTES + 1);
    } finally {
      closeSync(fd);
    }
    expect(await readBoundedSource(path)).toEqual({ state: "unavailable", reason: "over_budget" });
  } finally {
    rmSync(directory, { recursive: true });
  }
});
