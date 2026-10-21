import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const skill_local_revisions = sqliteTable(
  "skill_local_revisions",
  {
    package_path: text().notNull(),
    revision: integer().notNull(),
    content_hash: text().notNull(),
    captured_at: text().notNull(),
    reason: text().notNull(),
    restored_from: integer(),
    snapshot_json: text().notNull(),
  },
  (table) => [
    uniqueIndex("idx_skill_local_revisions_path_version").on(table.package_path, table.revision),
  ],
);
