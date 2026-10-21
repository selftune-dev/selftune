import { Schema } from "effect";

export const SkillPackageIndex = Schema.Struct({
  files: Schema.Array(
    Schema.Struct({ path: Schema.String, size: Schema.Number, symlink: Schema.Boolean }),
  ),
  limited: Schema.Boolean,
});
export const SkillPackageFile = Schema.Struct({
  path: Schema.String,
  size: Schema.Number,
  content: Schema.NullOr(Schema.String),
  reason: Schema.NullOr(Schema.Literals(["binary", "too_large", "symlink"])),
});
