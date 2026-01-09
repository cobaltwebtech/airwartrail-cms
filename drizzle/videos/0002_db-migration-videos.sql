ALTER TABLE `video` ADD `view_count_synced_at` integer;--> statement-breakpoint
ALTER TABLE `video` ADD `total_watch_time_ms` integer DEFAULT 0;