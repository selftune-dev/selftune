CREATE TABLE `skill_local_revisions` (
	`package_path` text NOT NULL,
	`revision` integer NOT NULL,
	`content_hash` text NOT NULL,
	`captured_at` text NOT NULL,
	`reason` text NOT NULL,
	`restored_from` integer,
	`snapshot_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_skill_local_revisions_path_version` ON `skill_local_revisions` (`package_path`,`revision`);