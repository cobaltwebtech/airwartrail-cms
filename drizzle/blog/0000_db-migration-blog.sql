CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`short_description` text,
	`post_content` text,
	`featured_image_url` text,
	`featured_image_alt` text,
	`publish_status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`author` text NOT NULL,
	`author_id` text,
	`is_featured` integer DEFAULT false NOT NULL,
	`reading_time_minutes` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);--> statement-breakpoint
CREATE INDEX `posts_slug_idx` ON `posts` (`slug`);--> statement-breakpoint
CREATE INDEX `posts_publish_status_idx` ON `posts` (`publish_status`);--> statement-breakpoint
CREATE INDEX `posts_author_idx` ON `posts` (`author`);--> statement-breakpoint
CREATE INDEX `posts_published_at_idx` ON `posts` (`published_at`);--> statement-breakpoint
CREATE INDEX `posts_created_at_idx` ON `posts` (`created_at`);