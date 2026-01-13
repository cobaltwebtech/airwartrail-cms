ALTER TABLE `video` RENAME COLUMN "ingest_type" TO "ingest_category";--> statement-breakpoint
ALTER TABLE `video` RENAME COLUMN "error_type" TO "error_category";--> statement-breakpoint
ALTER TABLE `video_track` RENAME COLUMN "type" TO "track_category";--> statement-breakpoint
ALTER TABLE `video_track` RENAME COLUMN "text_type" TO "text_category";--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_playlist` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`thumbnail_video_id` text,
	`thumbnail_time` real,
	`category` text DEFAULT 'featured' NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`published_at` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`tags` text,
	`custom_metadata` text,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `mux_library`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`thumbnail_video_id`) REFERENCES `video`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_playlist`("id", "library_id", "name", "slug", "description", "thumbnail_video_id", "thumbnail_time", "category", "is_published", "published_at", "sort_order", "tags", "custom_metadata", "is_deleted", "deleted_at", "created_at", "updated_at") SELECT "id", "library_id", "name", "slug", "description", "thumbnail_video_id", "thumbnail_time", "playlist", "is_published", "published_at", "sort_order", "tags", "custom_metadata", "is_deleted", "deleted_at", "created_at", "updated_at" FROM `playlist`;--> statement-breakpoint
DROP TABLE `playlist`;--> statement-breakpoint
ALTER TABLE `__new_playlist` RENAME TO `playlist`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `playlist_library_id_idx` ON `playlist` (`library_id`);--> statement-breakpoint
CREATE INDEX `playlist_slug_idx` ON `playlist` (`slug`);--> statement-breakpoint
CREATE INDEX `playlist_name_idx` ON `playlist` (`name`);--> statement-breakpoint
CREATE INDEX `playlist_category_idx` ON `playlist` (`category`);--> statement-breakpoint
CREATE INDEX `playlist_is_published_idx` ON `playlist` (`is_published`);--> statement-breakpoint
CREATE INDEX `playlist_sort_order_idx` ON `playlist` (`sort_order`);--> statement-breakpoint
CREATE INDEX `playlist_created_at_idx` ON `playlist` (`created_at`);--> statement-breakpoint
CREATE INDEX `playlist_published_category_idx` ON `playlist` (`is_published`,`category`);--> statement-breakpoint
CREATE UNIQUE INDEX `playlist_library_slug_unique_idx` ON `playlist` (`library_id`,`slug`);--> statement-breakpoint
DROP INDEX `video_track_type_idx`;--> statement-breakpoint
CREATE INDEX `video_track_track_category_idx` ON `video_track` (`track_category`);--> statement-breakpoint
DROP INDEX `playlist_item_playlist_video_unique_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `playlist_item_playlist_video_unique_idx` ON `playlist_item` (`playlist_id`,`video_id`);--> statement-breakpoint
CREATE INDEX `video_chapter_video_sort_idx` ON `video_chapter` (`video_id`,`sort_order`);