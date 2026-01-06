CREATE TABLE `mux_library` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`token_id` text NOT NULL,
	`token_secret` text NOT NULL,
	`signing_key_id` text,
	`signing_key_private` text,
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
	`ingest_type` text,
	`error_type` text,
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
CREATE TABLE `video_collection` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_public` integer DEFAULT false NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `mux_library`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `video_collection_library_id_idx` ON `video_collection` (`library_id`);--> statement-breakpoint
CREATE INDEX `video_collection_name_idx` ON `video_collection` (`name`);--> statement-breakpoint
CREATE TABLE `video_collection_item` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`video_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`added_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `video_collection`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `video`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `video_collection_item_collection_id_idx` ON `video_collection_item` (`collection_id`);--> statement-breakpoint
CREATE INDEX `video_collection_item_video_id_idx` ON `video_collection_item` (`video_id`);--> statement-breakpoint
CREATE INDEX `video_collection_item_sort_order_idx` ON `video_collection_item` (`sort_order`);--> statement-breakpoint
CREATE TABLE `video_moment` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`label` text NOT NULL,
	`timestamp` real NOT NULL,
	`description` text,
	`moment_type` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `video`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `video_moment_video_id_idx` ON `video_moment` (`video_id`);--> statement-breakpoint
CREATE INDEX `video_moment_timestamp_idx` ON `video_moment` (`timestamp`);--> statement-breakpoint
CREATE TABLE `video_track` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`mux_track_id` text NOT NULL,
	`type` text NOT NULL,
	`text_type` text,
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
CREATE INDEX `video_track_type_idx` ON `video_track` (`type`);