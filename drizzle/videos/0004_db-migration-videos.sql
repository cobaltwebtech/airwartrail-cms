CREATE TABLE `playlist` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`thumbnail_video_id` text,
	`thumbnail_time` real,
	`type` text DEFAULT 'manual' NOT NULL,
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
CREATE INDEX `playlist_library_id_idx` ON `playlist` (`library_id`);--> statement-breakpoint
CREATE INDEX `playlist_slug_idx` ON `playlist` (`slug`);--> statement-breakpoint
CREATE INDEX `playlist_name_idx` ON `playlist` (`name`);--> statement-breakpoint
CREATE INDEX `playlist_type_idx` ON `playlist` (`type`);--> statement-breakpoint
CREATE INDEX `playlist_is_published_idx` ON `playlist` (`is_published`);--> statement-breakpoint
CREATE INDEX `playlist_sort_order_idx` ON `playlist` (`sort_order`);--> statement-breakpoint
CREATE INDEX `playlist_created_at_idx` ON `playlist` (`created_at`);--> statement-breakpoint
CREATE INDEX `playlist_published_type_idx` ON `playlist` (`is_published`,`type`);--> statement-breakpoint
CREATE INDEX `playlist_library_slug_unique_idx` ON `playlist` (`library_id`,`slug`);--> statement-breakpoint
CREATE TABLE `playlist_item` (
	`id` text PRIMARY KEY NOT NULL,
	`playlist_id` text NOT NULL,
	`video_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`custom_title` text,
	`custom_description` text,
	`added_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlist`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `video`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `playlist_item_playlist_id_idx` ON `playlist_item` (`playlist_id`);--> statement-breakpoint
CREATE INDEX `playlist_item_video_id_idx` ON `playlist_item` (`video_id`);--> statement-breakpoint
CREATE INDEX `playlist_item_sort_order_idx` ON `playlist_item` (`sort_order`);--> statement-breakpoint
CREATE INDEX `playlist_item_playlist_sort_idx` ON `playlist_item` (`playlist_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `playlist_item_playlist_video_unique_idx` ON `playlist_item` (`playlist_id`,`video_id`);--> statement-breakpoint
DROP TABLE `video_collection`;--> statement-breakpoint
DROP TABLE `video_collection_item`;