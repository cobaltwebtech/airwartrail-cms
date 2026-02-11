// This file contains utility functions for formatting video data
import { format } from 'date-fns';

// ============================================================================
// Mux Thumbnail Helpers
// ============================================================================

export interface MuxThumbnailOptions {
	/** Width in pixels */
	width?: number;
	/** Height in pixels */
	height?: number;
	/** Time in seconds to capture the thumbnail from */
	time?: number;
	/** How to fit the image within the dimensions */
	fitMode?: 'preserve' | 'stretch' | 'crop' | 'smartcrop' | 'pad';
	/** Output format */
	format?: 'png' | 'jpg' | 'webp';
}

/**
 * Generates a Mux thumbnail URL for PUBLIC playback policy videos.
 * All parameters (time, width, height, etc.) are passed as query strings.
 *
 * @param playbackId - The Mux playback ID for the video
 * @param options - Configuration options for the thumbnail
 * @returns The thumbnail URL or null if no playback ID is provided
 * @see https://docs.mux.com/guides/get-images-from-a-video
 *
 * @example
 * getPublicThumbnailUrl('abc123', { width: 640, height: 360, time: 10 })
 * // Returns: https://image.mux.com/abc123/thumbnail.webp?width=640&height=360&time=10&fit_mode=smartcrop
 */
export function getPublicThumbnailUrl(
	playbackId: string | null | undefined,
	options: MuxThumbnailOptions = {},
): string | null {
	if (!playbackId) return null;

	const {
		width,
		height,
		time,
		fitMode = 'smartcrop',
		format = 'webp',
	} = options;

	const params = new URLSearchParams();
	if (width) params.set('width', width.toString());
	if (height) params.set('height', height.toString());
	if (time !== undefined) params.set('time', time.toString());
	if (fitMode) params.set('fit_mode', fitMode);

	const queryString = params.toString();
	return `https://image.mux.com/${playbackId}/thumbnail.${format}${queryString ? `?${queryString}` : ''}`;
}

/**
 * Generates a Mux thumbnail URL for SIGNED playback policy videos.
 * Per Mux docs, signed URLs should ONLY contain the token parameter.
 * The time, width, height, fit_mode params must be embedded in the JWT token itself.
 *
 * @param playbackId - The Mux playback ID for the video
 * @param token - The signed JWT token (must include params like time in its claims)
 * @param format - Output format (default: webp)
 * @returns The thumbnail URL or null if no playback ID or token is provided
 * @see https://docs.mux.com/guides/secure-video-playback
 *
 * @example
 * getSignedThumbnailUrl('abc123', 'eyJhbGciOiJSUzI1NiIs...')
 * // Returns: https://image.mux.com/abc123/thumbnail.webp?token=eyJhbGciOiJSUzI1NiIs...
 */
export function getSignedThumbnailUrl(
	playbackId: string | null | undefined,
	token: string | null | undefined,
	format: 'png' | 'jpg' | 'webp' = 'webp',
): string | null {
	if (!playbackId || !token) return null;

	return `https://image.mux.com/${playbackId}/thumbnail.${format}?token=${token}`;
}

/**
 * Generates a Mux thumbnail URL from a playback ID.
 * Automatically handles both public and signed playback policies.
 *
 * For PUBLIC videos: params are passed as query strings
 * For SIGNED videos: only the token is passed (params must be in JWT claims)
 *
 * @param playbackId - The Mux playback ID for the video
 * @param options - Configuration options for the thumbnail
 * @param token - Optional signed JWT token (if provided, creates signed URL)
 * @returns The thumbnail URL or null if no playback ID is provided
 */
export function getMuxThumbnailUrl(
	playbackId: string | null | undefined,
	options: MuxThumbnailOptions = {},
	token?: string | null,
): string | null {
	if (!playbackId) return null;

	// If token is provided, this is a signed video - use signed URL format
	if (token) {
		return getSignedThumbnailUrl(playbackId, token, options.format);
	}

	// Otherwise, use public URL format with query params
	return getPublicThumbnailUrl(playbackId, options);
}

/**
 * Gets the default thumbnail dimensions based on aspect ratio preference
 * @param aspectVideo - Whether to use 16:9 video aspect ratio
 * @returns Object with width and height
 */
export function getDefaultThumbnailDimensions(aspectVideo = false): {
	width: number;
	height: number;
} {
	return aspectVideo ? { width: 640, height: 360 } : { width: 160, height: 90 };
}

// ============================================================================
// Duration & Date Helpers
// ============================================================================

/**
 * Format duration from Mux (total seconds with decimal precision) to HH:MM:SS.S format
 * @param seconds - Duration in seconds (e.g., 23.857167)
 * @returns Formatted duration string (e.g., "00:00:23.9")
 */
export function formatDuration(seconds: number): string {
	if (!seconds || seconds < 0) return '00:00:00.0';

	const hrs = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);
	const tenths = Math.round((seconds % 1) * 10); // Round to 1 decimal place

	// Handle case where rounding tenths results in 10
	const adjustedTenths = tenths === 10 ? 0 : tenths;

	return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${adjustedTenths}`;
}

export function formatDate(dateString: string | undefined) {
	if (!dateString) return '';
	const date = new Date(dateString);
	return format(date, 'MMM dd, yyyy');
}

export function formatDateTime(dateString: string | undefined) {
	if (!dateString) return '';
	const date = new Date(dateString);
	return format(date, 'MMM dd, yyyy HH:mm:ss');
}
