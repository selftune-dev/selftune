import * as Schema from "effect/Schema";

export class RemoteIntegrityFailure extends Schema.TaggedError<RemoteIntegrityFailure>()(
  "RemoteIntegrityFailure",
  {
    expectedHash: Schema.String,
    actualHash: Schema.String,
  },
) {}

export class RemoteConflict extends Schema.TaggedError<RemoteConflict>()("RemoteConflict", {
  expectedParentId: Schema.NullOr(Schema.String),
  actualParentId: Schema.NullOr(Schema.String),
}) {}

export class RemoteObjectMissing extends Schema.TaggedError<RemoteObjectMissing>()(
  "RemoteObjectMissing",
  { objectHash: Schema.String },
) {}

export class RemoteLibraryUnavailable extends Schema.TaggedError<RemoteLibraryUnavailable>()(
  "RemoteLibraryUnavailable",
  { operation: Schema.String, message: Schema.String },
) {}
