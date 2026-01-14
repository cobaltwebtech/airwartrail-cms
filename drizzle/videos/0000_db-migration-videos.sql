CREATE TABLE `mux_library` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`mux_environment_id` text,
	`token_id` text NOT NULL,
	`token_secret` text NOT NULL,
	`signing_key_id` text,
	`signing_key_private` text,
	`webhook_secret` text,
	`default_playback_policy` text DEFAULT 'public' NOT NULL,
	`default_video_quality` text DEFAULT 'plus' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mux_library_name_idx` ON `mux_library` (`name`);--> statement-breakpoint
CREATE INDEX `mux_library_is_default_idx` ON `mux_library` (`is_default`);--> statement-breakpoint
CREATE TABLE `playlist` (
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
CREATE INDEX `playlist_library_id_idx` ON `playlist` (`library_id`);--> statement-breakpoint
CREATE INDEX `playlist_slug_idx` ON `playlist` (`slug`);--> statement-breakpoint
CREATE INDEX `playlist_name_idx` ON `playlist` (`name`);--> statement-breakpoint
CREATE INDEX `playlist_category_idx` ON `playlist` (`category`);--> statement-breakpoint
CREATE INDEX `playlist_is_published_idx` ON `playlist` (`is_published`);--> statement-breakpoint
CREATE INDEX `playlist_sort_order_idx` ON `playlist` (`sort_order`);--> statement-breakpoint
CREATE INDEX `playlist_created_at_idx` ON `playlist` (`created_at`);--> statement-breakpoint
CREATE INDEX `playlist_published_category_idx` ON `playlist` (`is_published`,`category`);--> statement-breakpoint
CREATE UNIQUE INDEX `playlist_library_slug_unique_idx` ON `playlist` (`library_id`,`slug`);--> statement-breakpoint
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
CREATE UNIQUE INDEX `playlist_item_playlist_video_unique_idx` ON `playlist_item` (`playlist_id`,`video_id`);--> statement-breakpoint
CREATE TABLE `video` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`mux_asset_id` text NOT NULL,
	`mux_playback_id` text,
	`mux_upload_id` text,
	`status` text DEFAULT 'preparing' NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`duration` real,
	`aspect_ratio` text,
	`max_width` integer,
	`max_height` integer,
	`max_frame_rate` real,
	`resolution_tier` text,
	`video_quality` text,
	`playback_policy` text DEFAULT 'public',
	`custom_thumbnail_time` real,
	`tags` text,
	`passthrough` text,
	`external_id` text,
	`creator_id` text,
	`custom_metadata` text,
	`is_published` integer DEFAULT false NOT NULL,
	`published_at` integer,
	`view_count` integer DEFAULT 0,
	`view_count_synced_at` integer,
	`total_watch_time_ms` integer DEFAULT 0,
	`ingest_category` text,
	`error_category` text,
	`error_messages` text,
	`is_test` integer DEFAULT false NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `mux_library`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `video_library_id_idx` ON `video` (`library_id`);--> statement-breakpoint
CREATE INDEX `video_mux_asset_id_idx` ON `video` (`mux_asset_id`);--> statement-breakpoint
CREATE INDEX `video_mux_playback_id_idx` ON `video` (`mux_playback_id`);--> statement-breakpoint
CREATE INDEX `video_status_idx` ON `video` (`status`);--> statement-breakpoint
CREATE INDEX `video_title_idx` ON `video` (`title`);--> statement-breakpoint
CREATE INDEX `video_is_published_idx` ON `video` (`is_published`);--> statement-breakpoint
CREATE INDEX `video_external_id_idx` ON `video` (`external_id`);--> statement-breakpoint
CREATE INDEX `video_created_at_idx` ON `video` (`created_at`);--> statement-breakpoint
CREATE TABLE `video_chapter` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`title` text NOT NULL,
	`start_time` real NOT NULL,
	`end_time` real,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`thumbnail_time` real,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `video`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `video_chapter_video_id_idx` ON `video_chapter` (`video_id`);--> statement-breakpoint
CREATE INDEX `video_chapter_sort_order_idx` ON `video_chapter` (`sort_order`);--> statement-breakpoint
CREATE INDEX `video_chapter_video_sort_idx` ON `video_chapter` (`video_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `video_track` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`mux_track_id` text NOT NULL,
	`track_category` text NOT NULL,
	`text_category` text,
	`language_code` text,
	`name` text,
	`status` text,
	`text_source` text,
	`closed_captions` integer DEFAULT false,
	`is_primary` integer DEFAULT false,
	`passthrough` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `video`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `video_track_video_id_idx` ON `video_track` (`video_id`);--> statement-breakpoint
CREATE INDEX `video_track_mux_track_id_idx` ON `video_track` (`mux_track_id`);--> statement-breakpoint
CREATE INDEX `video_track_track_category_idx` ON `video_track` (`track_category`);