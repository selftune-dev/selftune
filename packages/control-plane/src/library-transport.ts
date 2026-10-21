import * as Schema from "effect/Schema";
import { LibraryLocation, LibraryRevision, LibrarySkill, LibrarySnapshot } from "./domain/library";

const LocationId = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const Revision = Schema.Struct({
  ...LibraryRevision.fields,
  locations: Schema.Array(LocationId),
});
const Skill = Schema.Struct({
  ...LibrarySkill.fields,
  locations: Schema.Array(LocationId),
  revisions: Schema.Array(Revision),
});

/** Local transport only. The canonical library/export contract remains unchanged. */
export const CompactLibrarySnapshot = Schema.Struct({
  format: Schema.Literal("locations-v1"),
  generatedAt: LibrarySnapshot.fields.generatedAt,
  counts: LibrarySnapshot.fields.counts,
  skills: Schema.Array(Skill),
  locations: Schema.Array(LibraryLocation),
});
export type CompactLibrarySnapshot = typeof CompactLibrarySnapshot.Type;

export function compactLibrarySnapshot(snapshot: LibrarySnapshot): CompactLibrarySnapshot {
  const locations: LibraryLocation[] = [];
  const ids = new Map<string, number>();
  const intern = (location: LibraryLocation): number => {
    const key = JSON.stringify(location);
    const existing = ids.get(key);
    if (existing !== undefined) return existing;
    const id = locations.length;
    ids.set(key, id);
    locations.push(location);
    return id;
  };
  const skills = snapshot.skills.map((skill) => ({
    ...skill,
    locations: skill.locations.map(intern),
    revisions: skill.revisions.map((revision) => ({
      ...revision,
      locations: revision.locations.map(intern),
    })),
  }));
  return {
    format: "locations-v1",
    generatedAt: snapshot.generatedAt,
    counts: snapshot.counts,
    skills,
    locations,
  };
}

export function expandLibrarySnapshot(snapshot: CompactLibrarySnapshot): LibrarySnapshot {
  const resolve = (id: number): LibraryLocation => {
    const location = snapshot.locations[id];
    if (location === undefined)
      throw new Error("Library response contains an invalid location reference.");
    return location;
  };
  return {
    generatedAt: snapshot.generatedAt,
    counts: snapshot.counts,
    skills: snapshot.skills.map((skill) => ({
      ...skill,
      locations: skill.locations.map(resolve),
      revisions: skill.revisions.map((revision) => ({
        ...revision,
        locations: revision.locations.map(resolve),
      })),
    })),
  };
}
