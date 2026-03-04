//Custom type declarations go here
import type { $Infer } from './auth-client';
import type {
	DirectUploadStatus,
	PlaybackPolicy,
	VideoStatus,
} from './constants';

export type ActiveSession = typeof $Infer.Session;

// Re-export VideoStatus for backward compatibility
export type MuxAssetStatus = VideoStatus;

export interface MuxTrack {
	id: string;
	type: 'text' | 'audio' | 'video';
	textType?: 'captions' | 'subtitles';
	language?: string;
	languageCode?: string;
	name?: string;
	closed_captions?: boolean;
}

// Updated Video interface to use internal database IDs as primary identifier
export interface Video {
	// Internal database ID (primary identifier for navigation)
	id: string;
	// Mux identifiers
	muxAssetId?: string;
	playbackId: string | null;
	// Status and metadata
	status: VideoStatus;
	title: string;
	description?: string | null;
	thumbnail?: string;
	duration: number;
	createdAt: string;
	updatedAt?: string;
	captions?: MuxTrack[];
	metadata?: Record<string, unknown>;
	policy?: PlaybackPolicy | null;
	isPublished?: boolean;
	publishedAt?: string | null;
	scheduledReleaseDate?: string | null;
	// Video properties
	aspectRatio?: string | null;
	maxWidth?: number | null;
	maxHeight?: number | null;
	resolutionTier?: string | null;
	videoQuality?: string | null;
	// Analytics
	views?: number | null;
	// Deprecated fields kept for backward compatibility
	guid?: string;
	thumbnailFileName?: string;
	collectionId?: string;
	storageSize?: number;
	statusText?: string;
	dateUploaded?: string;
	chapters?: { title: string; start: number; end: number }[];
}

export interface DirectUpload {
	id: string;
	url: string;
	status: DirectUploadStatus;
	timeout: number;
	assetId?: string;
}

export interface Collection {
	videoLibraryId: number;
	guid: string;
	name: string;
	videoCount: number;
	totalSize: number;
	previewVideoIds: string;
	previewImageUrls: string[];
}
