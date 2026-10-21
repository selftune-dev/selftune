import type { Database } from "bun:sqlite";
import type { skill_local_revisions } from "./drizzle-schema.js";

export type StoredSkillRevision = typeof skill_local_revisions.$inferSelect;
export type SkillRevisionSummary = Omit<StoredSkillRevision, "snapshot_json">;

export function listSkillRevisions(
  db: Database,
  path: string,
  before = Number.MAX_SAFE_INTEGER,
): SkillRevisionSummary[] {
  return db
    .query<SkillRevisionSummary, [string, number]>(
      `SELECT package_path, revision, content_hash, captured_at, reason, restored_from
     FROM skill_local_revisions WHERE package_path = ? AND revision < ? ORDER BY revision DESC LIMIT 50`,
    )
    .all(path, before);
}

export function getSkillRevision(
  db: Database,
  path: string,
  revision: number,
): StoredSkillRevision | null {
  return db
    .query<StoredSkillRevision, [string, number]>(
      "SELECT * FROM skill_local_revisions WHERE package_path = ? AND revision = ?",
    )
    .get(path, revision);
}

export function recordSkillRevision(
  db: Database,
  input: Omit<StoredSkillRevision, "revision">,
): SkillRevisionSummary {
  return db
    .transaction(() => {
      const latest = listSkillRevisions(db, input.package_path)[0];
      if (latest?.content_hash === input.content_hash && input.restored_from === null)
        return latest;
      const revision = (latest?.revision ?? 0) + 1;
      db.query(`INSERT INTO skill_local_revisions
      (package_path, revision, content_hash, captured_at, reason, restored_from, snapshot_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        input.package_path,
        revision,
        input.content_hash,
        input.captured_at,
        input.reason,
        input.restored_from,
        input.snapshot_json,
      );
      const { snapshot_json: _snapshot, ...summary } = input;
      return { ...summary, revision };
    })
    .immediate();
}
