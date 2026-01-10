import { relations, sql } from 'drizzle-orm';
import {
	index,
	integer,
	real,
	sqliteTable,
	text,
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
		tags: text('tags'), // JSON array of tags
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
		ingestType: text('ingest_type', {
			enum: [
				'on_demand_url',
				'on_demand_direct_upload',
				'on_demand_clip',
				'live_rtmp',
				'live_srt',
			],
		}),
		// Error information
		errorType: text('error_type'),
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
		// Track type
		type: text('type', {
			enum: ['video', 'audio', 'text'],
		}).notNull(),
		// Text track specific fields
		textType: text('text_type', {
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
		index('video_track_type_idx').on(table.type),
	],
);

/**
 * Video Collection Schema
 * Groups videos into collections/playlists
 */
export const videoCollection = sqliteTable(
	'video_collection',
	{
		id: text('id').primaryKey(),
		libraryId: text('library_id')
			.notNull()
			.references(() => muxLibrary.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		// Visibility
		isPublic: integer('is_public', { mode: 'boolean' })
			.default(false)
			.notNull(),
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
		index('video_collection_library_id_idx').on(table.libraryId),
		index('video_collection_name_idx').on(table.name),
	],
);

/**
 * Video Collection Item Schema
 * Junction table for videos in collections (many-to-many)
 */
export const videoCollectionItem = sqliteTable(
	'video_collection_item',
	{
		id: text('id').primaryKey(),
		collectionId: text('collection_id')
			.notNull()
			.references(() => videoCollection.id, { onDelete: 'cascade' }),
		videoId: text('video_id')
			.notNull()
			.references(() => video.id, { onDelete: 'cascade' }),
		sortOrder: integer('sort_order').default(0).notNull(),
		addedAt: integer('added_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		index('video_collection_item_collection_id_idx').on(table.collectionId),
		index('video_collection_item_video_id_idx').on(table.videoId),
		index('video_collection_item_sort_order_idx').on(table.sortOrder),
	],
);

// ============================================================================
// Relations
// ============================================================================

export const muxLibraryRelations = relations(muxLibrary, ({ many }) => ({
	videos: many(video),
	collections: many(videoCollection),
}));

export const videoRelations = relations(video, ({ one, many }) => ({
	library: one(muxLibrary, {
		fields: [video.libraryId],
		references: [muxLibrary.id],
	}),
	chapters: many(videoChapter),
	tracks: many(videoTrack),
	collectionItems: many(videoCollectionItem),
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

export const videoCollectionRelations = relations(
	videoCollection,
	({ one, many }) => ({
		library: one(muxLibrary, {
			fields: [videoCollection.libraryId],
			references: [muxLibrary.id],
		}),
		items: many(videoCollectionItem),
	}),
);

export const videoCollectionItemRelations = relations(
	videoCollectionItem,
	({ one }) => ({
		collection: one(videoCollection, {
			fields: [videoCollectionItem.collectionId],
			references: [videoCollection.id],
		}),
		video: one(video, {
			fields: [videoCollectionItem.videoId],
			references: [video.id],
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

export type VideoCollection = typeof videoCollection.$inferSelect;
export type NewVideoCollection = typeof videoCollection.$inferInsert;

export type VideoCollectionItem = typeof videoCollectionItem.$inferSelect;
export type NewVideoCollectionItem = typeof videoCollectionItem.$inferInsert;
