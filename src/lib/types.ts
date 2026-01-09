//Custom type declarations go here
import type { $Infer } from './auth-client';

export type ActiveSession = typeof $Infer.Session;

// Mux Asset Status
export type MuxAssetStatus = 'preparing' | 'ready' | 'errored';

export interface MuxTrack {
	id: string;
	type: 'text' | 'audio' | 'video';
	textType?: 'captions' | 'subtitles';
	language?: string;
	languageCode?: string;
	name?: string;
	closed_captions?: boolean;
}

// Updated Video interface to use Mux Asset structure
export interface Video {
	id: string;
	playbackId: string;
	status: MuxAssetStatus;
	title: string;
	thumbnail?: string;
	duration: number;
	createdAt: string;
	updatedAt?: string;
	captions?: MuxTrack[];
	metadata?: Record<string, unknown>;
	policy?: 'public' | 'signed';
	isPublished?: boolean;
	// Deprecated fields kept for backward compatibility
	guid?: string;
	thumbnailFileName?: string;
	collectionId?: string;
	views?: number;
	storageSize?: number;
	statusText?: string;
	dateUploaded?: string;
	chapters?: { title: string; start: number; end: number }[];
}

export interface DirectUpload {
	id: string;
	url: string;
	status: 'waiting' | 'asset_created' | 'errored' | 'cancelled' | 'timed_out';
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
