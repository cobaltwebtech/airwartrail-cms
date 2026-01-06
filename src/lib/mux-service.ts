import type { DirectUpload, Video } from './types';

/**
 * Mux Video Service Library
 * Provides utility functions for working with Mux videos and uploads
 */

/**
 * Get the Mux player URL for a video
 */
export function getMuxPlayerUrl(playbackId: string): string {
	return `https://stream.mux.com/${playbackId}`;
}

/**
 * Get the Mux thumbnail URL for a video
 */
export function getMuxThumbnailUrl(
	playbackId: string,
	options?: { time?: number; width?: number; height?: number },
): string {
	let url = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
	const params = new URLSearchParams();

	if (options?.time !== undefined) {
		params.append('time', options.time.toString());
	}
	if (options?.width !== undefined) {
		params.append('width', options.width.toString());
	}
	if (options?.height !== undefined) {
		params.append('height', options.height.toString());
	}

	const queryString = params.toString();
	if (queryString) {
		url += `?${queryString}`;
	}

	return url;
}

/**
 * Get the Mux animated GIF URL for a video
 */
export function getMuxAnimatedGifUrl(
	playbackId: string,
	options?: { start?: number; duration?: number },
): string {
	let url = `https://image.mux.com/${playbackId}/animated.gif`;
	const params = new URLSearchParams();

	if (options?.start !== undefined) {
		params.append('start', options.start.toString());
	}
	if (options?.duration !== undefined) {
		params.append('duration', options.duration.toString());
	}

	const queryString = params.toString();
	if (queryString) {
		url += `?${queryString}`;
	}

	return url;
}

/**
 * Format duration in seconds to a human-readable string
 */
export function formatDuration(seconds: number): string {
	if (seconds === 0) return '0:00';

	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	const parts = [];
	if (hours > 0) {
		parts.push(hours.toString());
	}
	parts.push(minutes.toString().padStart(2, '0'));
	parts.push(secs.toString().padStart(2, '0'));

	return parts.join(':');
}

/**
 * Check if a video is still processing
 */
export function isVideoProcessing(status: Video['status']): boolean {
	return status === 'preparing';
}

/**
 * Check if a video is ready for playback
 */
export function isVideoReady(status: Video['status']): boolean {
	return status === 'ready';
}

/**
 * Check if a video has an error
 */
export function isVideoError(status: Video['status']): boolean {
	return status === 'errored';
}

/**
 * Convert a Mux Asset to Video interface (for backend compatibility)
 */
export function mapMuxAssetToVideo(asset: Video): Video {
	return {
		id: asset.id,
		playbackId: asset.playbackId,
		status: asset.status,
		title: asset.title,
		thumbnail: asset.thumbnail,
		duration: asset.duration,
		createdAt: asset.createdAt,
		updatedAt: asset.updatedAt,
		captions: asset.captions,
		metadata: asset.metadata,
		// Deprecated fields for backward compatibility
		guid: asset.id,
		collectionId: (asset.metadata?.collectionId as string) || undefined,
		views: 0,
		storageSize: 0,
		dateUploaded: asset.createdAt,
	};
}

/**
 * Extract collection ID from video metadata
 */
export function getCollectionIdFromVideo(video: Video): string | undefined {
	return (
		(video.metadata?.collectionId as string | undefined) || video.collectionId
	);
}

/**
 * Set collection ID in video metadata
 */
export function setCollectionIdInMetadata(
	metadata: Record<string, unknown> = {},
	collectionId: string,
): Record<string, unknown> {
	return {
		...metadata,
		collectionId,
	};
}

/**
 * Check if upload is complete
 */
export function isUploadComplete(upload: DirectUpload): boolean {
	return upload.status === 'asset_created';
}

/**
 * Check if upload has error
 */
export function isUploadError(upload: DirectUpload): boolean {
	return upload.status === 'errored';
}

/**
 * Check if upload is waiting
 */
export function isUploadWaiting(upload: DirectUpload): boolean {
	return upload.status === 'waiting';
}

/**
 * Get status message for upload
 */
export function getUploadStatusMessage(status: DirectUpload['status']): string {
	const messages: Record<DirectUpload['status'], string> = {
		waiting: 'Waiting for upload...',
		asset_created: 'Upload complete! Processing...',
		errored: 'Upload failed. Please try again.',
		cancelled: 'Upload cancelled.',
		timed_out: 'Upload timed out. Please try again.',
	};

	return messages[status] || 'Unknown status';
}

/**
 * Get status message for video
 */
export function getVideoStatusMessage(status: Video['status']): string {
	const messages: Record<Video['status'], string> = {
		preparing: 'Processing video...',
		ready: 'Ready to play',
		errored: 'There was an error processing this video',
	};

	return messages[status] || 'Unknown status';
}
