import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Option, flow } from "effect";
import { RemoteArtifact, RemoteSnapshot } from "@selftune/control-plane";
import { compactLibrarySnapshot } from "@selftune/control-plane/library-transport";
import type { LibrarySnapshot } from "@selftune/control-plane";
import { libraryIndexPage } from "@selftune/control-plane/library-index";

import { DashboardOperationError, type DashboardOperations } from "../dashboard-operations.js";
import { dashboardCorsHeaders, sameOriginFailure } from "../dashboard-http.js";

const BackupBody = Schema.Struct({ skill_id: Schema.String });
const libraryJson = new WeakMap<LibrarySnapshot, { full?: string; compact?: string }>();
export function librarySnapshotResponse(snapshot: LibrarySnapshot, compact: boolean): Response {
  const cached = libraryJson.get(snapshot) ?? {};
  const key = compact ? "compact" : "full";
  const json = cached[key] ?? JSON.stringify(compact ? compactLibrarySnapshot(snapshot) : snapshot);
  cached[key] = json;
  libraryJson.set(snapshot, cached);
  return new Response(json, {
    headers: { ...dashboardCorsHeaders(), "Content-Type": "application/json" },
  });
}
const InstallBody = Schema.Struct({
  skill_id: Schema.String,
  target_agent: Schema.Literals(["codex", "claude_code", "opencode", "openclaw", "pi"]),
});
const ShareBody = Schema.Union([
  Schema.Struct({
    skill_id: Schema.String,
    mode: Schema.Literals(["reusable_unlisted", "private_single_claim"]),
    delivery: Schema.Literal("copy_link"),
  }),
  Schema.Struct({
    skill_id: Schema.String,
    mode: Schema.Literal("private_single_claim"),
    delivery: Schema.Literal("email"),
    recipient_email: Schema.String,
  }),
]);
const ShareSkillSetBody = Schema.Union([
  Schema.Struct({
    set_id: Schema.String,
    mode: Schema.Literals(["reusable_unlisted", "private_single_claim"]),
    delivery: Schema.Literal("copy_link"),
  }),
  Schema.Struct({
    set_id: Schema.String,
    mode: Schema.Literal("private_single_claim"),
    delivery: Schema.Literal("email"),
    recipient_email: Schema.String,
  }),
]);
const LicenseDraftTermsBody = Schema.Struct({
  copyright_holder: Schema.String,
  licensed_organization: Schema.String,
  year: Schema.Number,
});
const PreviewLicenseBody = Schema.Struct({
  set_id: Schema.optional(Schema.String),
  skill_id: Schema.String,
  terms: LicenseDraftTermsBody,
});
const ApplyLicenseBody = Schema.Struct({
  set_id: Schema.optional(Schema.String),
  skill_id: Schema.String,
  preview_id: Schema.String,
  terms: LicenseDraftTermsBody,
});

function licenseTerms(body: typeof LicenseDraftTermsBody.Type) {
  return {
    copyrightHolder: body.copyright_holder,
    licensedOrganization: body.licensed_organization,
    year: body.year,
  };
}

const BackupArtifact = Schema.NullOr(
  Schema.Struct({
    artifactId: RemoteArtifact.fields.artifactId,
    artifactType: RemoteArtifact.fields.artifactType,
  }),
).pipe(Schema.catchDecoding(() => Effect.succeed(Option.some(null))));
const LibraryBackup = Schema.Struct({
  snapshot: Schema.Struct({
    snapshotId: RemoteSnapshot.fields.snapshotId.check(Schema.isNonEmpty()),
    artifacts: Schema.Array(BackupArtifact),
  }),
});
export const decodeLibraryBackup = flow(
  Schema.decodeUnknownOption(LibraryBackup),
  Option.getOrUndefined,
);

export function backedArtifact(value: typeof LibraryBackup.Type | undefined, skillId: string) {
  const snapshot = value?.snapshot;
  if (!snapshot) return null;
  const artifact = snapshot.artifacts.find(
    (candidate) =>
      candidate?.artifactType === "skill_revision" &&
      candidate.artifactId.startsWith(`skill/${skillId}/`),
  );
  return artifact ? { snapshotId: snapshot.snapshotId, artifactId: artifact.artifactId } : null;
}

function invalidBody(operation: string, message: string): DashboardOperationError {
  return DashboardOperationError.make({
    operation,
    code: "MISSING_FLAG",
    message,
    status: 400,
    retryable: false,
  });
}

const decode = Effect.fn("DashboardApplication.decodeLibraryTransfer")(function* <
  S extends Schema.Top,
>(request: Request, operation: string, schema: S, message: string) {
  const input = yield* Effect.tryPromise({
    try: () => request.json(),
    catch: () => invalidBody(operation, message),
  });
  return yield* Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError(() => invalidBody(operation, message)),
  );
});

export const routeLibraryTransfer = Effect.fn("DashboardApplication.routeLibraryTransfer")(
  function* (
    request: Request,
    url: URL,
    allowedOrigins: ReadonlySet<string>,
    operations: DashboardOperations["Service"],
  ) {
    if (url.pathname === "/api/v2/library" && request.method === "GET") {
      let snapshot = yield* operations.library;
      const expected = url.searchParams.get("snapshot");
      if (expected !== null && expected !== snapshot.generatedAt)
        return {
          response: Response.json(
            { error: "The library changed. Refresh and try again." },
            { status: 409, headers: dashboardCorsHeaders() },
          ),
          installed: false,
        };
      if (url.searchParams.get("view") === "index") {
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const limit = Number(url.searchParams.get("limit") ?? 50);
        const search = url.searchParams.get("search") ?? "";
        if (
          !Number.isSafeInteger(offset) ||
          offset < 0 ||
          !Number.isSafeInteger(limit) ||
          limit < 1 ||
          limit > 100 ||
          search.length > 1024
        )
          return yield* invalidBody(
            "library.index",
            "Use an offset >= 0, limit 1..100, and a search under 1024 characters.",
          );
        const classificationText = new Map<string, string>();
        if (search.trim()) {
          const report = yield* operations.skillIntelligence;
          for (const classification of report.classifications)
            classificationText.set(
              classification.skill_id.toLowerCase(),
              [classification.category_label, ...classification.matched_terms].join(" "),
            );
        }
        return {
          response: Response.json(
            libraryIndexPage(snapshot, { offset, limit, search, classificationText }),
            { headers: dashboardCorsHeaders() },
          ),
          installed: false,
        };
      }
      const selectedId = url.searchParams.get("skill_id");
      if (selectedId !== null) {
        const skill = snapshot.skills.find((item) => item.skillId === selectedId);
        if (!skill)
          return {
            response: Response.json(
              { error: "Skill is no longer in the library. Refresh and try again." },
              { status: 404, headers: dashboardCorsHeaders() },
            ),
            installed: false,
          };
        snapshot = {
          generatedAt: snapshot.generatedAt,
          skills: [skill],
          counts: { total: 1, active: 0, library: 0, draft: 0, archived: 0, [skill.lifecycle]: 1 },
        };
      }
      return {
        response: librarySnapshotResponse(snapshot, url.searchParams.get("format") === "compact"),
        installed: false,
      };
    }
    if (request.method !== "POST") return null;
    if (
      ![
        "/api/v2/library/backup",
        "/api/v2/library/install",
        "/api/v2/library/share",
        "/api/v2/library/license/preview",
        "/api/v2/library/license/apply",
        "/api/v2/skill-sets/share",
      ].includes(url.pathname)
    ) {
      return null;
    }
    const unauthorized = sameOriginFailure(request, allowedOrigins);
    if (unauthorized) return { response: unauthorized, installed: false };
    if (url.pathname === "/api/v2/library/license/preview") {
      const body = yield* decode(
        request,
        "library.license.preview",
        PreviewLicenseBody,
        "skill_id and license terms are required.",
      );
      return {
        response: Response.json(
          yield* operations.previewLicenseDraft(
            body.skill_id,
            licenseTerms(body.terms),
            body.set_id,
          ),
          { headers: dashboardCorsHeaders() },
        ),
        installed: false,
      };
    }
    if (url.pathname === "/api/v2/library/license/apply") {
      const body = yield* decode(
        request,
        "library.license.apply",
        ApplyLicenseBody,
        "skill_id, preview_id, and license terms are required.",
      );
      return {
        response: Response.json(
          yield* operations.applyLicenseDraft(
            body.skill_id,
            body.preview_id,
            licenseTerms(body.terms),
            body.set_id,
          ),
          { headers: dashboardCorsHeaders() },
        ),
        installed: false,
      };
    }
    if (url.pathname === "/api/v2/skill-sets/share") {
      const body = yield* decode(
        request,
        "skill_sets.share",
        ShareSkillSetBody,
        "set_id and share details are required.",
      );
      const input =
        body.delivery === "email"
          ? {
              skillSetId: body.set_id,
              mode: "private_single_claim" as const,
              delivery: "email" as const,
              recipientEmail: body.recipient_email,
            }
          : {
              skillSetId: body.set_id,
              mode: body.mode,
              delivery: "copy_link" as const,
            };
      return {
        response: Response.json(yield* operations.remoteLibraryShare("create", input), {
          headers: dashboardCorsHeaders(),
        }),
        installed: false,
      };
    }
    if (url.pathname === "/api/v2/library/backup") {
      const body = yield* decode(
        request,
        "library.skill.backup",
        BackupBody,
        "skill_id is required.",
      );
      return {
        response: Response.json(yield* operations.backupLibrarySkill(body.skill_id), {
          headers: dashboardCorsHeaders(),
        }),
        installed: false,
      };
    }
    if (url.pathname === "/api/v2/library/share") {
      const body = yield* decode(
        request,
        "library.skill.share",
        ShareBody,
        "Share details are required.",
      );
      const backup = yield* operations.backupLibrarySkill(body.skill_id);
      const artifact = backedArtifact(decodeLibraryBackup(backup), body.skill_id);
      if (!artifact) {
        return yield* invalidBody(
          "library.skill.share",
          "The backed-up skill artifact could not be resolved.",
        );
      }
      const input =
        body.delivery === "email"
          ? {
              skillId: body.skill_id,
              ...artifact,
              mode: "private_single_claim" as const,
              delivery: "email" as const,
              recipientEmail: body.recipient_email,
            }
          : {
              skillId: body.skill_id,
              ...artifact,
              mode: body.mode,
              delivery: "copy_link" as const,
            };
      return {
        response: Response.json(yield* operations.remoteLibraryShare("create", input), {
          headers: dashboardCorsHeaders(),
        }),
        installed: false,
      };
    }
    const body = yield* decode(
      request,
      "library.skill.install",
      InstallBody,
      "skill_id and target_agent are required.",
    );
    return {
      response: Response.json(
        yield* operations.installLibrarySkill(body.skill_id, body.target_agent),
        { headers: dashboardCorsHeaders() },
      ),
      installed: true,
    };
  },
);
