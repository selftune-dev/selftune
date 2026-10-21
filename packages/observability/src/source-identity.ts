import { createHash } from "node:crypto";
import * as Schema from "effect/Schema";

export const SourceProvider = Schema.Literals(["claude_code", "codex", "opencode", "pi", "otlp"]);
export const SourceSessionIds = Schema.Array(
  Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(256)),
).check(Schema.isMinLength(1), Schema.isMaxLength(256));
export const SourceIdentity = Schema.Struct({
  provider: SourceProvider,
  session_id: Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(256)),
});
export interface SourceIdentity extends Schema.Schema.Type<typeof SourceIdentity> {}
export const SourceIdentities = Schema.Array(SourceIdentity).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(256),
);

/** Logical source identity deliberately excludes path, revision, batch and normalizer. */
export const sourceIdentityKey = (identity: SourceIdentity): string =>
  createHash("sha256")
    .update(JSON.stringify(["selftune-source/v1", identity.provider, identity.session_id]))
    .digest("hex");
