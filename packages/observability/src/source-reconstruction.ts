import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import * as Schema from "effect/Schema";

/** Per-demand I/O bound, not a retention policy. Larger sources remain unqualified. */
export const MAX_RECONSTRUCTION_BYTES = 8 * 1024 * 1024;
export const CODEX_RECONSTRUCTION_PARSER = "codex-rollout/v1";
const Text = Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(512));
const FilePath = Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(4096));
export const SourceSnapshot = Schema.Struct({
  parser: Schema.Literal(CODEX_RECONSTRUCTION_PARSER),
  path: FilePath,
  sha256: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  task_sha256: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  bytes: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThan(0),
    Schema.isLessThanOrEqualTo(MAX_RECONSTRUCTION_BYTES),
  ),
  skill_names: Schema.Array(Text).check(Schema.isMaxLength(1024)),
  workspace_skills: Schema.Array(
    Schema.Struct({
      cwd: FilePath,
      names: Schema.Array(Text).check(Schema.isMaxLength(1024)),
    }),
  ).check(Schema.isMaxLength(16)),
}).check(
  Schema.makeFilter(
    (snapshot) =>
      snapshot.workspace_skills.reduce(
        (count, workspace) => count + workspace.names.length,
        snapshot.skill_names.length,
      ) <= 1024,
  ),
);
export interface SourceSnapshot extends Schema.Schema.Type<typeof SourceSnapshot> {}

export const SourceReconstruction = Schema.Struct({
  snapshot: SourceSnapshot,
  bindings: Schema.Array(
    Schema.Struct({
      skill_invocation_id: Text,
      skill_name: Text,
      skill_revision: Schema.NullOr(Text),
    }),
  ).check(Schema.isMaxLength(256)),
});
export interface SourceReconstruction extends Schema.Schema.Type<typeof SourceReconstruction> {}

export type SourceTaskResolution =
  | { readonly state: "available"; readonly task: string; readonly source: "verified_original" }
  | {
      readonly state: "unavailable";
      readonly reason:
        | "missing"
        | "expired"
        | "source_missing"
        | "source_unavailable"
        | "source_changed"
        | "unverified_skill_revision"
        | "normalizer_changed"
        | "projection_changed"
        | "over_budget";
    };

export const sourceDigest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** Read one regular file from one descriptor; never follow a final symlink or read unboundedly. */
export async function readBoundedSource(path: string): Promise<
  | { readonly state: "available"; readonly bytes: Buffer }
  | {
      readonly state: "unavailable";
      readonly reason: "source_missing" | "source_unavailable" | "over_budget";
    }
> {
  try {
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = await file.stat();
      if (!before.isFile()) return { state: "unavailable", reason: "source_unavailable" };
      if (before.size === 0 || before.size > MAX_RECONSTRUCTION_BYTES)
        return { state: "unavailable", reason: "over_budget" };
      const bytes = Buffer.alloc(before.size + 1);
      let offset = 0;
      while (offset < bytes.length) {
        // oxlint-disable-next-line no-await-in-loop -- bounded reads from one verified file descriptor.
        const read = await file.read(bytes, offset, bytes.length - offset, offset);
        if (read.bytesRead === 0) break;
        offset += read.bytesRead;
      }
      const after = await file.stat();
      if (offset !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs)
        return { state: "unavailable", reason: "source_unavailable" };
      return { state: "available", bytes: bytes.subarray(0, offset) };
    } finally {
      await file.close();
    }
  } catch (error) {
    return {
      state: "unavailable",
      reason:
        error instanceof Error && "code" in error && error.code === "ENOENT"
          ? "source_missing"
          : "source_unavailable",
    };
  }
}
