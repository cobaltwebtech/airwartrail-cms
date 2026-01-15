/**
 * Shared constants derived from database schema enums
 * Update these when schema enum values change
 */

// ============================================================================
// Playlist Categories
// ============================================================================

/**
 * Playlist category values - must match video-schema.ts playlist.category enum
 */
export const PLAYLIST_CATEGORIES = [
	'featured',
	'interviews',
	'series',
	'short-form',
	'other',
] as const;

export type PlaylistCategory = (typeof PLAYLIST_CATEGORIES)[number];

/**
 * Human-readable labels for playlist categories
 */
export const PLAYLIST_CATEGORY_LABELS: Record<PlaylistCategory, string> = {
	featured: 'Featured',
	interviews: 'Oral History Interviews',
	series: 'Series',
	'short-form': 'Short Form',
	other: 'Other',
};

/**
 * Descriptions for playlist categories (used in forms)
 */
export const PLAYLIST_CATEGORY_DESCRIPTIONS: Record<PlaylistCategory, string> =
	{
		featured:
			'Curated collection of featured videos that are more prominently displayed.',
		interviews: 'Collection of oral history interviews.',
		series: 'A video series with sequential episodes.',
		'short-form': 'Shorter-length videos typically under 10 minutes.',
		other: 'Other videos that do not fit into standard categories.',
	};

/**
 * Playlist category options for Select components
 */
export const PLAYLIST_CATEGORY_OPTIONS = PLAYLIST_CATEGORIES.map((value) => ({
	value,
	label: PLAYLIST_CATEGORY_LABELS[value],
	description: PLAYLIST_CATEGORY_DESCRIPTIONS[value],
}));

/**
 * Get the label for a playlist category
 */
export function getPlaylistCategoryLabel(category: PlaylistCategory): string {
	return PLAYLIST_CATEGORY_LABELS[category] ?? category;
}

// ============================================================================
// Video Status
// ============================================================================

/**
 * Video status values - must match video-schema.ts video.status enum
 * Note: 'waiting' is used by Mux during initial upload before processing begins
 */
export const VIDEO_STATUSES = [
	'waiting',
	'preparing',
	'ready',
	'errored',
] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

/**
 * Human-readable labels for video statuses
 */
export const VIDEO_STATUS_LABELS: Record<VideoStatus, string> = {
	waiting: 'Waiting',
	preparing: 'Processing',
	ready: 'Ready',
	errored: 'Error',
};

/**
 * Get the label for a video status
 */
export function getVideoStatusLabel(status: VideoStatus): string {
	return VIDEO_STATUS_LABELS[status] ?? status;
}

// ============================================================================
// Track Status
// ============================================================================

/**
 * Track status values - must match video-schema.ts videoTrack.status enum
 */
export const TRACK_STATUSES = [
	'preparing',
	'ready',
	'errored',
	'deleted',
] as const;
export type TrackStatus = (typeof TRACK_STATUSES)[number];

// ============================================================================
// Playback Policy
// ============================================================================

/**
 * Video playback policy values - must match video-schema.ts playbackPolicy enum
 */
export const PLAYBACK_POLICIES = ['public', 'signed'] as const;
export type PlaybackPolicy = (typeof PLAYBACK_POLICIES)[number];

/**
 * Human-readable labels for playback policies
 */
export const PLAYBACK_POLICY_LABELS: Record<PlaybackPolicy, string> = {
	public: 'Public',
	signed: 'Signed',
};

/**
 * Descriptions for playback policies
 */
export const PLAYBACK_POLICY_DESCRIPTIONS: Record<PlaybackPolicy, string> = {
	public: 'Anyone with the URL can view the video',
	signed: 'Requires a signed token to view the video',
};

// ============================================================================
// Video Quality
// ============================================================================

/**
 * Video quality values - must match video-schema.ts videoQuality enum
 */
export const VIDEO_QUALITIES = ['basic', 'plus', 'premium'] as const;
export type VideoQuality = (typeof VIDEO_QUALITIES)[number];

/**
 * Human-readable labels for video qualities
 */
export const VIDEO_QUALITY_LABELS: Record<VideoQuality, string> = {
	basic: 'Basic',
	plus: 'Plus',
	premium: 'Premium',
};

// ============================================================================
// Resolution Tier
// ============================================================================

/**
 * Resolution tier values - must match video-schema.ts resolutionTier enum
 */
export const RESOLUTION_TIERS = [
	'audio-only',
	'720p',
	'1080p',
	'1440p',
	'2160p',
] as const;
export type ResolutionTier = (typeof RESOLUTION_TIERS)[number];

/**
 * Human-readable labels for resolution tiers
 */
export const RESOLUTION_TIER_LABELS: Record<ResolutionTier, string> = {
	'audio-only': 'Audio Only',
	'720p': '720p (HD)',
	'1080p': '1080p (Full HD)',
	'1440p': '1440p (2K)',
	'2160p': '2160p (4K)',
};

// ============================================================================
// Direct Upload Status
// ============================================================================

/**
 * Direct upload status values from Mux
 */
export const DIRECT_UPLOAD_STATUSES = [
	'waiting',
	'asset_created',
	'errored',
	'cancelled',
	'timed_out',
] as const;
export type DirectUploadStatus = (typeof DIRECT_UPLOAD_STATUSES)[number];

// ============================================================================
// Track Categories
// ============================================================================

/**
 * Track category values - must match video-schema.ts videoTrack.trackCategory enum
 */
export const TRACK_CATEGORIES = ['video', 'audio', 'text'] as const;
export type TrackCategory = (typeof TRACK_CATEGORIES)[number];

/**
 * Text track category values
 */
export const TEXT_TRACK_CATEGORIES = ['subtitles'] as const;
export type TextTrackCategory = (typeof TEXT_TRACK_CATEGORIES)[number];

/**
 * Text track source values
 */
export const TEXT_TRACK_SOURCES = [
	'uploaded',
	'embedded',
	'generated_vod',
	'generated_live',
	'generated_live_final',
] as const;
export type TextTrackSource = (typeof TEXT_TRACK_SOURCES)[number];

// ============================================================================
// Ingest Categories
// ============================================================================

/**
 * Video ingest category values - must match video-schema.ts video.ingestCategory enum
 */
export const INGEST_CATEGORIES = [
	'on_demand_url',
	'on_demand_direct_upload',
	'on_demand_clip',
	'live_rtmp',
	'live_srt',
] as const;
export type IngestCategory = (typeof INGEST_CATEGORIES)[number];

// ============================================================================
// Supported Languages for Auto-Generated Captions
// ============================================================================

/**
 * Supported languages for Mux auto-generated captions
 * Languages marked as 'beta' may have lower accuracy
 */
export const SUPPORTED_LANGUAGES = [
	{ code: 'en', name: 'English', status: 'stable' },
	{ code: 'es', name: 'Spanish', status: 'stable' },
	{ code: 'it', name: 'Italian', status: 'stable' },
	{ code: 'pt', name: 'Portuguese', status: 'stable' },
	{ code: 'de', name: 'German', status: 'stable' },
	{ code: 'fr', name: 'French', status: 'stable' },
	{ code: 'pl', name: 'Polish', status: 'beta' },
	{ code: 'ru', name: 'Russian', status: 'beta' },
	{ code: 'nl', name: 'Dutch', status: 'beta' },
	{ code: 'ca', name: 'Catalan', status: 'beta' },
	{ code: 'tr', name: 'Turkish', status: 'beta' },
	{ code: 'sv', name: 'Swedish', status: 'beta' },
	{ code: 'uk', name: 'Ukrainian', status: 'beta' },
	{ code: 'no', name: 'Norwegian', status: 'beta' },
	{ code: 'fi', name: 'Finnish', status: 'beta' },
	{ code: 'sk', name: 'Slovak', status: 'beta' },
	{ code: 'el', name: 'Greek', status: 'beta' },
	{ code: 'cs', name: 'Czech', status: 'beta' },
	{ code: 'hr', name: 'Croatian', status: 'beta' },
	{ code: 'da', name: 'Danish', status: 'beta' },
	{ code: 'ro', name: 'Romanian', status: 'beta' },
	{ code: 'bg', name: 'Bulgarian', status: 'beta' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];
export type LanguageStatus = (typeof SUPPORTED_LANGUAGES)[number]['status'];
