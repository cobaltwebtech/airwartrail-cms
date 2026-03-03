CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`file_url` text NOT NULL,
	`file_size` integer,
	`mime_type` text,
	`publish_status` text DEFAULT 'draft' NOT NULL,
	`author` text NOT NULL,
	`author_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `documents_publish_status_idx` ON `documents` (`publish_status`);--> statement-breakpoint
CREATE INDEX `documents_author_idx` ON `documents` (`author`);--> statement-breakpoint
CREATE INDEX `documents_created_at_idx` ON `documents` (`created_at`);