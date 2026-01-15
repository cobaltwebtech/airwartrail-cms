import { relations, sql } from 'drizzle-orm';
import {
	index,
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * Mux Library (Environment) Schema
 * Stores configuration for different Mux environments/libraries
 * Each library represents a separate Mux environment with its own API credentials
 */
export const muxLibrary = sqliteTable(
	'mux_library',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		description: text('description'),
		// Mux Environment ID (from Mux dashboard, used for webhook routing)
		muxEnvironmentId: text('mux_environment_id'),
		// Mux API credentials (stored encrypted in production)
		tokenId: text('token_id').notNull(),
		tokenSecret: text('token_secret').notNull(),
		// Custom signing key for signed playback URLs
		signingKeyId: text('signing_key_id'),
		signingKeyPrivate: text('signing_key_private'),
		// Webhook signing secret (stored encrypted)
		webhookSecret: text('webhook_secret'),
		// Library settings
		defaultPlaybackPolicy: text('default_playback_policy', {
			enum: ['public', 'signed'],
		})
			.default('public')
			.notNull(),
		defaultVideoQuality: text('default_video_quality', {
			enum: ['basic', 'plus', 'premium'],
		})
			.default('plus')
			.notNull(),
		// Whether this is the default library
		isDefault: integer('is_default', { mode: 'boolean' })
			.default(false)
			.notNull(),
		// Soft delete and timestamps
		isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index('mux_library_name_idx').on(table.name),
		index('mux_library_is_default_idx').on(table.isDefault),
	],
);

/**
 * Video Schema
 * Stores video metadata linking internal IDs to Mux asset IDs
 * along with custom metadata for the application
 */
export const video = sqliteTable(
	'video',
	{
		// Internal primary key (UUID)
		id: text('id').primaryKey(),
		// Reference to the Mux library/environment
		libraryId: text('library_id')
			.notNull()
			.references(() => muxLibrary.id, { onDelete: 'cascade' }),
		// Mux-specific identifiers
		muxAssetId: text('mux_asset_id').notNull(),
		muxPlaybackId: text('mux_playback_id'),
		muxUploadId: text('mux_upload_id'),
		// Video status (synced from Mux)
		status: text('status', {
			enum: ['preparing', 'ready', 'errored'],
		})
			.default('preparing')
			.notNull(),
		// Video metadata
		title: text('title').notNull(),
		description: text('description'),
		// Video properties (populated after Mux processing)
		duration: real('duration'), // Duration in seconds
		aspectRatio: text('aspect_ratio'), // e.g., "16:9"
		maxWidth: integer('max_width'),
		maxHeight: integer('max_height'),
		maxFrameRate: real('max_frame_rate'),
		resolutionTier: text('resolution_tier', {
			enum: ['audio-only', '720p', '1080p', '1440p', '2160p'],
		}),
		videoQuality: text('video_quality', {
			enum: ['basic', 'plus', 'premium'],
		}),
		// Playback settings
		playbackPolicy: text('playback_policy', {
			enum: ['public', 'signed'],
		}).default('public'),
		// Custom thumbnail (optional, otherwise Mux auto-generates)
		customThumbnailTime: real('custom_thumbnail_time'),
		// User-defined metadata
		passthrough: text('passthrough'), // Arbitrary passthrough data (max 255 chars)
		externalId: text('external_id'), // Link to external system
		creatorId: text('creator_id'), // ID of content creator
		// Additional custom fields for application-specific needs
		customMetadata: text('custom_metadata'), // JSON object for extensibility
		// Visibility and organization
		isPublished: integer('is_published', { mode: 'boolean' })
			.default(false)
			.notNull(),
		publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
		// Analytics (cached from Mux Data or custom tracking)
		viewCount: integer('view_count').default(0),
		viewCountSyncedAt: integer('view_count_synced_at', {
			mode: 'timestamp_ms',
		}), // Last time we synced views from Mux
		totalWatchTimeMs: integer('total_watch_time_ms').default(0), // Cumulative watch time in milliseconds
		// Processing info
		ingestCategory: text('ingest_category', {
			enum: [
				'on_demand_url',
				'on_demand_direct_upload',
				'on_demand_clip',
				'live_rtmp',
				'live_srt',
			],
		}),
		// Error information
		errorCategory: text('error_category'),
		errorMessages: text('error_messages'), // JSON array of error messages
		// Test asset flag
		isTest: integer('is_test', { mode: 'boolean' }).default(false).notNull(),
		// Soft delete and timestamps
		isDeleted: integer('is_deleted', { mode: 'boolean' })
			.default(false)
			.notNull(),
		deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index('video_library_id_idx').on(table.libraryId),
		index('video_mux_asset_id_idx').on(table.muxAssetId),
		index('video_mux_playback_id_idx').on(table.muxPlaybackId),
		index('video_status_idx').on(table.status),
		index('video_title_idx').on(table.title),
		index('video_is_published_idx').on(table.isPublished),
		index('video_external_id_idx').on(table.externalId),
		index('video_created_at_idx').on(table.createdAt),
	],
);

/**
 * Video Chapter Schema
 * Stores chapter markers for videos
 */
export const videoChapter = sqliteTable(
	'video_chapter',
	{
		id: text('id').primaryKey(),
		videoId: text('video_id')
			.notNull()
			.references(() => video.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		startTime: real('start_time').notNull(), // Start time in seconds
		endTime: real('end_time'), // End time in seconds (optional, can be inferred)
		sortOrder: integer('sort_order').default(0).notNull(),
		// Optional thumbnail for the chapter
		thumbnailTime: real('thumbnail_time'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index('video_chapter_video_id_idx').on(table.videoId),
		index('video_chapter_sort_order_idx').on(table.sortOrder),
		// Composite index for fetching chapters in order for a video
		index('video_chapter_video_sort_idx').on(table.videoId, table.sortOrder),
	],
);

/**
 * Video Caption/Track Schema
 * Stores information about text tracks (captions/subtitles)
 */
export const videoTrack = sqliteTable(
	'video_track',
	{
		id: text('id').primaryKey(),
		videoId: text('video_id')
			.notNull()
			.references(() => video.id, { onDelete: 'cascade' }),
		// Mux track ID
		muxTrackId: text('mux_track_id').notNull(),
		// Track category
		trackCategory: text('track_category', {
			enum: ['video', 'audio', 'text'],
		}).notNull(),
		// Text track specific fields
		textCategory: text('text_category', {
			enum: ['subtitles'],
		}),
		languageCode: text('language_code'), // BCP 47 language code (e.g., "en-US")
		name: text('name'), // Display name (e.g., "English")
		// Status of the track (for generated tracks)
		status: text('status', {
			enum: ['preparing', 'ready', 'errored', 'deleted'],
		}),
		// Track source
		textSource: text('text_source', {
			enum: [
				'uploaded',
				'embedded',
				'generated_vod',
				'generated_live',
				'generated_live_final',
			],
		}),
		// Whether this is for deaf/hard-of-hearing
		closedCaptions: integer('closed_captions', { mode: 'boolean' }).default(
			false,
		),
		// Whether this is the primary track
		isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),
		// Passthrough data
		passthrough: text('passthrough'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index('video_track_video_id_idx').on(table.videoId),
		index('video_track_mux_track_id_idx').on(table.muxTrackId),
		index('video_track_track_category_idx').on(table.trackCategory),
	],
);

/**
 * Playlist Schema
 * User-facing curated lists of videos (series, courses, featured content)
 */
export const playlist = sqliteTable(
	'playlist',
	{
		id: text('id').primaryKey(),
		libraryId: text('library_id')
			.notNull()
			.references(() => muxLibrary.id, { onDelete: 'cascade' }),
		// Playlist metadata
		name: text('name').notNull(),
		slug: text('slug').notNull(), // URL-friendly identifier
		description: text('description'),
		// Thumbnail can reference a specific video or custom time
		thumbnailVideoId: text('thumbnail_video_id').references(() => video.id, {
			onDelete: 'set null',
		}),
		thumbnailTime: real('thumbnail_time'), // Custom thumbnail time in seconds
		// Playlist category for different use cases
		category: text('category', {
			enum: ['featured', 'interviews', 'series', 'short-form', 'other'],
		})
			.default('featured')
			.notNull(),
		// Visibility and publishing
		isPublished: integer('is_published', { mode: 'boolean' })
			.default(false)
			.notNull(),
		publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
		// Ordering for displaying playlists
		sortOrder: integer('sort_order').default(0).notNull(),
		// Optional metadata
		tags: text('tags'), // JSON array of tags
		customMetadata: text('custom_metadata'), // JSON object for extensibility
		// Soft delete and timestamps
		isDeleted: integer('is_deleted', { mode: 'boolean' })
			.default(false)
			.notNull(),
		deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index('playlist_library_id_idx').on(table.libraryId),
		index('playlist_slug_idx').on(table.slug),
		index('playlist_name_idx').on(table.name),
		index('playlist_category_idx').on(table.category),
		index('playlist_is_published_idx').on(table.isPublished),
		index('playlist_sort_order_idx').on(table.sortOrder),
		index('playlist_created_at_idx').on(table.createdAt),
		// Composite index for common query: published playlists by category
		index('playlist_published_category_idx').on(
			table.isPublished,
			table.category,
		),
		// Unique slug per library (enforced at database level)
		uniqueIndex('playlist_library_slug_unique_idx').on(
			table.libraryId,
			table.slug,
		),
	],
);

/**
 * Playlist Item Schema
 * Junction table for videos in playlists with ordering
 */
export const playlistItem = sqliteTable(
	'playlist_item',
	{
		id: text('id').primaryKey(),
		playlistId: text('playlist_id')
			.notNull()
			.references(() => playlist.id, { onDelete: 'cascade' }),
		videoId: text('video_id')
			.notNull()
			.references(() => video.id, { onDelete: 'cascade' }),
		// Position in playlist (1-based for user display)
		sortOrder: integer('sort_order').default(0).notNull(),
		// Optional item-specific metadata
		customTitle: text('custom_title'), // Override video title in this playlist
		customDescription: text('custom_description'), // Override description
		// Timestamps
		addedAt: integer('added_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		index('playlist_item_playlist_id_idx').on(table.playlistId),
		index('playlist_item_video_id_idx').on(table.videoId),
		index('playlist_item_sort_order_idx').on(table.sortOrder),
		// Composite index for fetching playlist videos in order
		index('playlist_item_playlist_sort_idx').on(
			table.playlistId,
			table.sortOrder,
		),
		// Unique constraint: prevent duplicate videos in same playlist (enforced at database level)
		uniqueIndex('playlist_item_playlist_video_unique_idx').on(
			table.playlistId,
			table.videoId,
		),
	],
);

/**
 * Video Tag Definition Schema
 * Centralized registry of all available tags across all libraries
 * Tags are global and can be used by any video regardless of library
 */
export const videoTag = sqliteTable(
	'video_tag',
	{
		id: text('id').primaryKey(),
		// Normalized tag name (lowercase, trimmed, URL-friendly)
		slug: text('slug').notNull().unique(),
		// Human-readable display name
		name: text('name').notNull(),
		// Optional description for admin reference
		description: text('description'),
		// Metadata
		isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index('video_tag_slug_idx').on(table.slug),
		index('video_tag_name_idx').on(table.name),
		index('video_tag_is_active_idx').on(table.isActive),
	],
);

/**
 * Video-Tag Junction Table
 * Maps videos to their tags (many-to-many relationship)
 */
export const videoTagAssignment = sqliteTable(
	'video_tag_assignment',
	{
		id: text('id').primaryKey(),
		videoId: text('video_id')
			.notNull()
			.references(() => video.id, { onDelete: 'cascade' }),
		tagId: text('tag_id')
			.notNull()
			.references(() => videoTag.id, { onDelete: 'cascade' }),
		// When this tag was assigned to the video
		assignedAt: integer('assigned_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		index('video_tag_assignment_video_id_idx').on(table.videoId),
		index('video_tag_assignment_tag_id_idx').on(table.tagId),
		// Unique constraint: prevent duplicate tag assignments
		uniqueIndex('video_tag_assignment_unique_idx').on(
			table.videoId,
			table.tagId,
		),
	],
);

// ============================================================================
// Relations
// ============================================================================

export const muxLibraryRelations = relations(muxLibrary, ({ many }) => ({
	videos: many(video),
	playlists: many(playlist),
}));

export const videoRelations = relations(video, ({ one, many }) => ({
	library: one(muxLibrary, {
		fields: [video.libraryId],
		references: [muxLibrary.id],
	}),
	chapters: many(videoChapter),
	tracks: many(videoTrack),
	playlistItems: many(playlistItem),
	// Playlists that use this video as thumbnail
	playlistThumbnails: many(playlist),
	// Tags assigned to this video
	tagAssignments: many(videoTagAssignment),
}));

export const videoChapterRelations = relations(videoChapter, ({ one }) => ({
	video: one(video, {
		fields: [videoChapter.videoId],
		references: [video.id],
	}),
}));

export const videoTrackRelations = relations(videoTrack, ({ one }) => ({
	video: one(video, {
		fields: [videoTrack.videoId],
		references: [video.id],
	}),
}));

export const playlistRelations = relations(playlist, ({ one, many }) => ({
	library: one(muxLibrary, {
		fields: [playlist.libraryId],
		references: [muxLibrary.id],
	}),
	thumbnailVideo: one(video, {
		fields: [playlist.thumbnailVideoId],
		references: [video.id],
	}),
	items: many(playlistItem),
}));

export const playlistItemRelations = relations(playlistItem, ({ one }) => ({
	playlist: one(playlist, {
		fields: [playlistItem.playlistId],
		references: [playlist.id],
	}),
	video: one(video, {
		fields: [playlistItem.videoId],
		references: [video.id],
	}),
}));

export const videoTagRelations = relations(videoTag, ({ many }) => ({
	// Videos that have this tag
	videoAssignments: many(videoTagAssignment),
}));

export const videoTagAssignmentRelations = relations(
	videoTagAssignment,
	({ one }) => ({
		video: one(video, {
			fields: [videoTagAssignment.videoId],
			references: [video.id],
		}),
		tag: one(videoTag, {
			fields: [videoTagAssignment.tagId],
			references: [videoTag.id],
		}),
	}),
);

// ============================================================================
// Type Exports
// ============================================================================

export type MuxLibrary = typeof muxLibrary.$inferSelect;
export type NewMuxLibrary = typeof muxLibrary.$inferInsert;

export type Video = typeof video.$inferSelect;
export type NewVideo = typeof video.$inferInsert;

export type VideoChapter = typeof videoChapter.$inferSelect;
export type NewVideoChapter = typeof videoChapter.$inferInsert;

export type VideoTrack = typeof videoTrack.$inferSelect;
export type NewVideoTrack = typeof videoTrack.$inferInsert;

export type Playlist = typeof playlist.$inferSelect;
export type NewPlaylist = typeof playlist.$inferInsert;

export type PlaylistItem = typeof playlistItem.$inferSelect;
export type NewPlaylistItem = typeof playlistItem.$inferInsert;

export type VideoTag = typeof videoTag.$inferSelect;
export type NewVideoTag = typeof videoTag.$inferInsert;

export type VideoTagAssignment = typeof videoTagAssignment.$inferSelect;
export type NewVideoTagAssignment = typeof videoTagAssignment.$inferInsert;
