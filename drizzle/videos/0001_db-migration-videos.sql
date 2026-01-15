CREATE TABLE `video_tag` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_tag_slug_unique` ON `video_tag` (`slug`);--> statement-breakpoint
CREATE INDEX `video_tag_slug_idx` ON `video_tag` (`slug`);--> statement-breakpoint
CREATE INDEX `video_tag_name_idx` ON `video_tag` (`name`);--> statement-breakpoint
CREATE INDEX `video_tag_is_active_idx` ON `video_tag` (`is_active`);--> statement-breakpoint
CREATE TABLE `video_tag_assignment` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`assigned_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `video`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `video_tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `video_tag_assignment_video_id_idx` ON `video_tag_assignment` (`video_id`);--> statement-breakpoint
CREATE INDEX `video_tag_assignment_tag_id_idx` ON `video_tag_assignment` (`tag_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `video_tag_assignment_unique_idx` ON `video_tag_assignment` (`video_id`,`tag_id`);--> statement-breakpoint
ALTER TABLE `video` DROP COLUMN `tags`;