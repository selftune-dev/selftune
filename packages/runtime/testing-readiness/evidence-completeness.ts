import { isAbsolute, resolve } from "node:path";
import { Effect, Option, Schema } from "effect";
import { flow } from "effect/Function";
import { EvaluationHistory } from "@selftune/control-plane/domain/evaluation-report";
import {
  MAX_RECONSTRUCTION_BYTES,
  readBoundedSource,
  sourceDigest,
  SourceReconstruction,
} from "@selftune/observability/source-reconstruction";
import { GradingResult } from "../types.js";
import { EvalEntry } from "../types/evaluation.js";

const ExplicitPath = Schema.String.check(
  Schema.isNonEmpty(),
  Schema.isMaxLength(4096),
  Schema.makeFilter(isAbsolute),
);
export const EvidenceInspectionRequest = Schema.Struct({
  artifacts: Schema.Array(
    Schema.Struct({
      kind: Schema.Literals(["grade", "routing_evals", "evaluation_history", "source_recipe"]),
      path: ExplicitPath,
    }),
  ).check(Schema.isMinLength(1), Schema.isMaxLength(16)),
  authorized_sources: Schema.Array(ExplicitPath).check(Schema.isMaxLength(16)),
}).check(
  Schema.makeFilter(
    (request) =>
      new Set(request.artifacts.map((artifact) => resolve(artifact.path))).size ===
      request.artifacts.length,
  ),
);

export class EvidenceInspectionFailure extends Schema.TaggedError<EvidenceInspectionFailure>()(
  "EvidenceInspectionFailure",
  { message: Schema.String },
) {}

type Category = "self_contained" | "source_dependent" | "missing" | "unsupported";
const categoryFor = {
  routing_inputs_embedded: "self_contained",
  grade_original_unverified: "source_dependent",
  recipe_original_verified: "source_dependent",
  source_not_authorized: "source_dependent",
  evaluation_summary_only: "source_dependent",
  artifact_missing: "missing",
  source_path_missing: "missing",
  source_missing: "missing",
  source_changed: "missing",
  empty_inputs: "missing",
  unsupported_contract: "unsupported",
  artifact_unavailable: "unsupported",
  source_unavailable: "unsupported",
  artifact_over_budget: "unsupported",
  source_over_budget: "unsupported",
  source_reference_unsupported: "unsupported",
} satisfies Record<string, Category>;
type Reason = keyof typeof categoryFor;

/** Content-completeness only. This contract never authorizes eviction or claims replay validity. */
export interface EvidenceCompletenessReport {
  readonly schema_version: "1.0.0";
  readonly scope: "explicit_artifact_content_only";
  readonly decision: "keep_all_sources";
  readonly artifacts_assessed: number;
  readonly replay_qualified: 0;
  readonly eviction_eligible: 0;
  readonly counts: Readonly<Record<Category, number>>;
  readonly reasons: Readonly<Record<Reason, number>>;
  readonly limits: {
    readonly max_artifacts: 16;
    readonly max_source_reads: 16;
    readonly max_bytes_per_file: number;
  };
}

const decode = <A>(schema: Schema.Codec<A>, raw: string) =>
  Schema.decodeUnknownOption(Schema.fromJsonString(schema), { onExcessProperty: "error" })(raw);
const RoutingEvals = Schema.Array(EvalEntry).check(Schema.isMaxLength(256));

const inspectSource = Effect.fn("EvidenceCompleteness.inspectSource")(function* (
  path: string,
  authorized: ReadonlySet<string>,
  expected?: { readonly sha256: string; readonly bytes: number },
): Effect.fn.Return<Reason> {
  if (!path.trim()) return "source_path_missing";
  if (!isAbsolute(path)) return "source_reference_unsupported";
  if (!authorized.has(resolve(path))) return "source_not_authorized";
  const result = yield* Effect.promise(() => readBoundedSource(path));
  if (result.state === "unavailable") {
    switch (result.reason) {
      case "source_missing":
        return "source_missing";
      case "source_unavailable":
        return "source_unavailable";
      case "over_budget":
        return "source_over_budget";
    }
  }
  if (!expected) return "grade_original_unverified";
  if (result.bytes.length !== expected.bytes || sourceDigest(result.bytes) !== expected.sha256)
    return "source_changed";
  return "recipe_original_verified";
});

const inspectArtifact = Effect.fn("EvidenceCompleteness.inspectArtifact")(function* (
  artifact: (typeof EvidenceInspectionRequest.Type.artifacts)[number],
  authorized: ReadonlySet<string>,
): Effect.fn.Return<Reason> {
  const result = yield* Effect.promise(() => readBoundedSource(artifact.path));
  if (result.state === "unavailable") {
    switch (result.reason) {
      case "source_missing":
        return "artifact_missing";
      case "source_unavailable":
        return "artifact_unavailable";
      case "over_budget":
        return "artifact_over_budget";
    }
  }
  const raw = result.bytes.toString("utf8");
  switch (artifact.kind) {
    case "grade": {
      const grade = decode(GradingResult, raw);
      return Option.isSome(grade)
        ? yield* inspectSource(grade.value.transcript_path, authorized)
        : "unsupported_contract";
    }
    case "routing_evals": {
      const entries = decode(RoutingEvals, raw);
      if (Option.isNone(entries)) return "unsupported_contract";
      return entries.value.length > 0 &&
        entries.value.every((entry) => entry.query.trim().length > 0)
        ? "routing_inputs_embedded"
        : "empty_inputs";
    }
    case "evaluation_history": {
      const history = decode(EvaluationHistory, raw);
      if (Option.isNone(history)) return "unsupported_contract";
      return history.value.length > 0 ? "evaluation_summary_only" : "empty_inputs";
    }
    case "source_recipe": {
      const recipe = decode(SourceReconstruction, raw);
      return Option.isSome(recipe)
        ? yield* inspectSource(recipe.value.snapshot.path, authorized, recipe.value.snapshot)
        : "unsupported_contract";
    }
  }
});

const inspectRequest = Effect.fn("EvidenceCompleteness.inspect")(function* (
  request: typeof EvidenceInspectionRequest.Type,
): Effect.fn.Return<EvidenceCompletenessReport> {
  const authorized = new Set(request.authorized_sources.map((path) => resolve(path)));
  const counts = { self_contained: 0, source_dependent: 0, missing: 0, unsupported: 0 };
  const reasons: Record<Reason, number> = {
    routing_inputs_embedded: 0,
    grade_original_unverified: 0,
    recipe_original_verified: 0,
    source_not_authorized: 0,
    evaluation_summary_only: 0,
    artifact_missing: 0,
    source_path_missing: 0,
    source_missing: 0,
    source_changed: 0,
    empty_inputs: 0,
    unsupported_contract: 0,
    artifact_unavailable: 0,
    source_unavailable: 0,
    artifact_over_budget: 0,
    source_over_budget: 0,
    source_reference_unsupported: 0,
  };
  for (const artifact of request.artifacts) {
    const reason = yield* inspectArtifact(artifact, authorized);
    counts[categoryFor[reason]]++;
    reasons[reason]++;
  }
  return {
    schema_version: "1.0.0",
    scope: "explicit_artifact_content_only",
    decision: "keep_all_sources",
    artifacts_assessed: request.artifacts.length,
    counts,
    reasons,
    replay_qualified: 0,
    eviction_eligible: 0,
    limits: {
      max_artifacts: 16,
      max_source_reads: 16,
      max_bytes_per_file: MAX_RECONSTRUCTION_BYTES,
    },
  };
});

/** Explicit files only; decode before I/O. Never opens a database or discovers dependencies. */
export const inspectEvidenceCompleteness = flow(
  Schema.decodeUnknownEffect(EvidenceInspectionRequest),
  Effect.mapError(
    () =>
      new EvidenceInspectionFailure({
        message:
          "Invalid evidence inspection request; supply 1–16 distinct absolute artifact paths and at most 16 authorized source paths.",
      }),
  ),
  Effect.flatMap(inspectRequest),
);
