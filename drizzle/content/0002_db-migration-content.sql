CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`page_content` text,
	`publish_status` text DEFAULT 'unpublished' NOT NULL,
	`published_at` integer,
	`author` text NOT NULL,
	`author_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_slug_unique` ON `pages` (`slug`);--> statement-breakpoint
CREATE INDEX `pages_slug_idx` ON `pages` (`slug`);--> statement-breakpoint
CREATE INDEX `pages_publish_status_idx` ON `pages` (`publish_status`);--> statement-breakpoint
CREATE INDEX `pages_author_idx` ON `pages` (`author`);--> statement-breakpoint
CREATE INDEX `pages_published_at_idx` ON `pages` (`published_at`);--> statement-breakpoint
CREATE INDEX `pages_created_at_idx` ON `pages` (`created_at`);