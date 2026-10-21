import * as Schema from "effect/Schema";
import {
  LibraryCounts,
  LibraryLocation,
  LibraryOrigin,
  LibrarySkill,
  LibrarySnapshot,
} from "./domain/library";
import { recommendLibraryConsolidation } from "./library-consolidation";

const Connection = Schema.Struct({
  harness: LibraryLocation.fields.harness,
  packagePath: LibraryLocation.fields.packagePath,
  scope: LibraryLocation.fields.scope,
  sourceKind: LibraryLocation.fields.sourceKind,
  removable: Schema.Boolean,
});
const Origin = Schema.Struct({
  ...LibraryOrigin.fields,
  packagePath: Schema.NullOr(Schema.String),
});
export const LibraryIndexSkill = Schema.Struct({
  skillId: LibrarySkill.fields.skillId,
  name: LibrarySkill.fields.name,
  lifecycle: LibrarySkill.fields.lifecycle,
  lastUsedAt: LibrarySkill.fields.lastUsedAt,
  lastModifiedAt: LibrarySkill.fields.lastModifiedAt,
  updateStatus: LibrarySkill.fields.updateStatus,
  instructionBytes: LibrarySkill.fields.instructionBytes,
  origins: Schema.Array(Origin),
  connections: Schema.Array(Connection),
  revisionHashes: Schema.Array(Schema.String),
  installedCount: Schema.Number,
  consolidationAvailable: Schema.Boolean,
});
export type LibraryIndexSkill = typeof LibraryIndexSkill.Type;
export const LibraryIndexPage = Schema.Struct({
  generatedAt: LibrarySnapshot.fields.generatedAt,
  counts: LibraryCounts,
  total: Schema.Number,
  nextOffset: Schema.NullOr(Schema.Number),
  skills: Schema.Array(LibraryIndexSkill),
});
export type LibraryIndexPage = typeof LibraryIndexPage.Type;

const indexes = new WeakMap<LibrarySnapshot, readonly LibraryIndexSkill[]>();
const harnessNames = {
  codex: "Codex",
  claude_code: "Claude Code",
  opencode: "OpenCode",
  openclaw: "OpenClaw",
  pi: "Pi",
};

export function libraryIndexPage(
  snapshot: LibrarySnapshot,
  options: {
    offset: number;
    limit: number;
    search: string;
    classificationText?: ReadonlyMap<string, string>;
  },
): LibraryIndexPage {
  let rows = indexes.get(snapshot);
  if (!rows) {
    rows = snapshot.skills.map((skill) => {
      const connections = new Map<LibraryLocation["harness"], typeof Connection.Type>();
      let installedCount = 0;
      for (const location of skill.locations) {
        if (location.sourceKind === "installed") installedCount++;
        const previous = connections.get(location.harness);
        connections.set(location.harness, {
          harness: location.harness,
          packagePath: previous?.packagePath ?? location.packagePath,
          scope: previous?.scope ?? location.scope,
          sourceKind: previous?.sourceKind ?? location.sourceKind,
          removable:
            Boolean(previous?.removable) ||
            (skill.name.toLowerCase() !== "selftune" &&
              location.active &&
              location.sourceKind === "installed" &&
              location.scope !== "admin" &&
              location.scope !== "system"),
        });
      }
      return {
        skillId: skill.skillId,
        name: skill.name,
        lifecycle: skill.lifecycle,
        lastUsedAt: skill.lastUsedAt,
        lastModifiedAt: skill.lastModifiedAt,
        updateStatus: skill.updateStatus,
        instructionBytes: skill.instructionBytes,
        origins: skill.origins.map((origin) => ({
          ...origin,
          packagePath:
            skill.locations.find(
              (location) =>
                location.origin?.kind === origin.kind && location.origin.label === origin.label,
            )?.packagePath ??
            skill.locations[0]?.packagePath ??
            null,
        })),
        connections: [...connections.values()],
        revisionHashes: skill.revisions.map((revision) => revision.contentHash),
        installedCount,
        consolidationAvailable: recommendLibraryConsolidation(skill) !== null,
      };
    });
    indexes.set(snapshot, rows);
  }
  const query = options.search.trim().toLowerCase();
  const matching = query
    ? new Set(
        snapshot.skills
          .filter((skill) =>
            [
              skill.name,
              skill.lifecycle === "active" ? "Ready" : "Stored",
              options.classificationText?.get(skill.skillId.toLowerCase()) ?? "",
              ...skill.origins.map((origin) => origin.label),
              ...skill.locations.flatMap((location) => [
                location.packagePath,
                location.scope,
                location.harness ? harnessNames[location.harness] : "",
              ]),
            ]
              .join(" ")
              .toLowerCase()
              .includes(query),
          )
          .map((skill) => skill.skillId),
      )
    : null;
  const filtered = matching ? rows.filter((row) => matching.has(row.skillId)) : rows;
  const end = options.offset + options.limit;
  return {
    generatedAt: snapshot.generatedAt,
    counts: snapshot.counts,
    total: filtered.length,
    nextOffset: end < filtered.length ? end : null,
    skills: filtered.slice(options.offset, end),
  };
}
