CREATE TABLE `album_images` (
	`id` text PRIMARY KEY NOT NULL,
	`album_id` text NOT NULL,
	`image_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `album_images_album_image_unique` ON `album_images` (`album_id`,`image_id`);--> statement-breakpoint
CREATE INDEX `album_images_album_id_idx` ON `album_images` (`album_id`);--> statement-breakpoint
CREATE INDEX `album_images_image_id_idx` ON `album_images` (`image_id`);--> statement-breakpoint
CREATE INDEX `album_images_sort_order_idx` ON `album_images` (`album_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `albums` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`cover_image_id` text,
	`publish_status` text DEFAULT 'draft' NOT NULL,
	`author_id` text,
	`image_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`cover_image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `albums_slug_unique` ON `albums` (`slug`);--> statement-breakpoint
CREATE INDEX `albums_slug_idx` ON `albums` (`slug`);--> statement-breakpoint
CREATE INDEX `albums_publish_status_idx` ON `albums` (`publish_status`);--> statement-breakpoint
CREATE INDEX `albums_author_id_idx` ON `albums` (`author_id`);--> statement-breakpoint
CREATE INDEX `albums_created_at_idx` ON `albums` (`created_at`);--> statement-breakpoint
CREATE TABLE `blog_posts` (
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
CREATE UNIQUE INDEX `blog_posts_slug_unique` ON `blog_posts` (`slug`);--> statement-breakpoint
CREATE INDEX `posts_slug_idx` ON `blog_posts` (`slug`);--> statement-breakpoint
CREATE INDEX `posts_publish_status_idx` ON `blog_posts` (`publish_status`);--> statement-breakpoint
CREATE INDEX `posts_author_idx` ON `blog_posts` (`author`);--> statement-breakpoint
CREATE INDEX `posts_published_at_idx` ON `blog_posts` (`published_at`);--> statement-breakpoint
CREATE INDEX `posts_created_at_idx` ON `blog_posts` (`created_at`);--> statement-breakpoint
CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`cf_image_id` text NOT NULL,
	`delivery_url` text NOT NULL,
	`file_name` text,
	`alt_text` text,
	`width` integer,
	`height` integer,
	`require_signed_urls` integer DEFAULT false NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `images_cf_image_id_unique` ON `images` (`cf_image_id`);--> statement-breakpoint
CREATE INDEX `images_cf_image_id_idx` ON `images` (`cf_image_id`);--> statement-breakpoint
CREATE INDEX `images_created_at_idx` ON `images` (`created_at`);