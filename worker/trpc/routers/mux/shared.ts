import { TRPCError } from "@trpc/server";
import Mux from "@mux/mux-node";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import {
	muxLibrary,
	type MuxLibrary,
} from "@/db/video-schema";
import { encrypt, decrypt } from "@/worker/lib/encryption";

// ============================================================================
// Types
// ============================================================================

export type MuxAssetState = "preparing" | "ready" | "errored";

export interface MuxAsset {
	id: string;
	playbackId: string;
	status: MuxAssetState;
	title: string;
	thumbnail?: string;
	duration: number;
	createdAt: string;
	updatedAt?: string;
	captions?: MuxTrack[];
	metadata?: Record<string, unknown>;
	policy?: "public" | "signed";
	// Additional Mux asset metadata
	resolutionTier?: "audio-only" | "720p" | "1080p" | "1440p" | "2160p";
	aspectRatio?: string;
	videoQuality?: "basic" | "plus" | "premium";
	maxStoredFrameRate?: number;
	maxWidth?: number;
	maxHeight?: number;
	// Analytics
	views?: number;
	// Database metadata
	isPublished?: boolean;
}

export interface MuxTrack {
	id: string;
	type: "text" | "audio" | "video";
	textType?: "captions" | "subtitles";
	language?: string;
	languageCode?: string;
	name?: string;
	closed_captions?: boolean;
}

export interface DirectUpload {
	id: string;
	url: string;
	status: "waiting" | "asset_created" | "errored" | "cancelled" | "timed_out";
	timeout: number;
	assetId?: string;
}

export interface ThumbnailParams {
	time?: number;
	width?: number;
	height?: number;
	fit_mode?: string;
}

// ============================================================================
// Language Code Mapping
// ============================================================================

export const LANGUAGE_NAMES: Record<string, string> = {
	en: 'English',
	es: 'Spanish',
	it: 'Italian',
	pt: 'Portuguese',
	de: 'German',
	fr: 'French',
	pl: 'Polish',
	ru: 'Russian',
	nl: 'Dutch',
	ca: 'Catalan',
	tr: 'Turkish',
	sv: 'Swedish',
	uk: 'Ukrainian',
	no: 'Norwegian',
	fi: 'Finnish',
	sk: 'Slovak',
	el: 'Greek',
	cs: 'Czech',
	hr: 'Croatian',
	da: 'Danish',
	ro: 'Romanian',
	bg: 'Bulgarian',
};

export function getLanguageName(code: string): string {
	return LANGUAGE_NAMES[code] || code.toUpperCase();
}

// ============================================================================
// Database & Encryption Utilities
// ============================================================================

export function getVideosDb(env: Env) {
	return drizzle(env.DB_VIDEOS);
}

function getEncryptionSecret(env: Env): string {
	const secret = env.DB_VIDEOS_SECRET;
	if (!secret) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Encryption secret not configured",
		});
	}
	return secret;
}

export async function encryptLibraryCredentials<
	T extends {
		tokenId?: string;
		tokenSecret?: string;
		signingKeyId?: string | null;
		signingKeyPrivate?: string | null;
		webhookSecret?: string | null;
	},
>(data: T, env: Env): Promise<T> {
	const secret = getEncryptionSecret(env);
	const result = { ...data };

	if (data.tokenId) {
		(result as { tokenId: string }).tokenId = await encrypt(data.tokenId, secret);
	}
	if (data.tokenSecret) {
		(result as { tokenSecret: string }).tokenSecret = await encrypt(data.tokenSecret, secret);
	}
	if (data.signingKeyId) {
		(result as { signingKeyId: string }).signingKeyId = await encrypt(data.signingKeyId, secret);
	}
	if (data.signingKeyPrivate) {
		(result as { signingKeyPrivate: string }).signingKeyPrivate = await encrypt(data.signingKeyPrivate, secret);
	}
	if (data.webhookSecret) {
		(result as { webhookSecret: string }).webhookSecret = await encrypt(data.webhookSecret, secret);
	}

	return result;
}

export async function decryptLibraryCredentials(
	library: MuxLibrary,
	env: Env,
): Promise<MuxLibrary> {
	const secret = getEncryptionSecret(env);

	try {
		return {
			...library,
			tokenId: library.tokenId ? await decrypt(library.tokenId, secret) : library.tokenId,
			tokenSecret: library.tokenSecret ? await decrypt(library.tokenSecret, secret) : library.tokenSecret,
			signingKeyId: library.signingKeyId ? await decrypt(library.signingKeyId, secret) : library.signingKeyId,
			signingKeyPrivate: library.signingKeyPrivate ? await decrypt(library.signingKeyPrivate, secret) : library.signingKeyPrivate,
			webhookSecret: library.webhookSecret ? await decrypt(library.webhookSecret, secret) : library.webhookSecret,
		};
	} catch (error) {
		// If decryption fails, credentials might be stored in plain text (legacy/migration)
		console.warn("Failed to decrypt library credentials, using raw values:", error);
		return library;
	}
}

// ============================================================================
// Library & Client Management
// ============================================================================

export async function getMuxLibrary(
	env: Env,
	libraryId?: string,
): Promise<MuxLibrary> {
	const db = getVideosDb(env);

	let library: MuxLibrary | undefined;

	if (libraryId) {
		// Get specific library by ID
		const result = await db
			.select()
			.from(muxLibrary)
			.where(and(eq(muxLibrary.id, libraryId), eq(muxLibrary.isActive, true)))
			.limit(1);
		library = result[0];
	} else {
		// Get the default library
		const result = await db
			.select()
			.from(muxLibrary)
			.where(and(eq(muxLibrary.isDefault, true), eq(muxLibrary.isActive, true)))
			.limit(1);
		library = result[0];

		// If no default, get the first active library
		if (!library) {
			const fallback = await db
				.select()
				.from(muxLibrary)
				.where(eq(muxLibrary.isActive, true))
				.limit(1);
			library = fallback[0];
		}
	}

	if (!library) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: libraryId
				? `Mux library with ID ${libraryId} not found`
				: "No Mux library configured. Please set up a Mux library first.",
		});
	}

	// Decrypt sensitive credentials before returning
	return decryptLibraryCredentials(library, env);
}

export async function getMuxClient(env: Env, libraryId?: string): Promise<{ mux: Mux; library: MuxLibrary }> {
	const library = await getMuxLibrary(env, libraryId);

	if (!library.tokenId || !library.tokenSecret) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Mux credentials not configured for this library",
		});
	}

	const mux = new Mux({
		tokenId: library.tokenId,
		tokenSecret: library.tokenSecret,
	});

	return { mux, library };
}

// ============================================================================
// Token Generation
// ============================================================================

export async function generateSignedTokens(
	playbackId: string,
	library: MuxLibrary,
	expiresIn: number = 3600,
	thumbnailParams?: ThumbnailParams,
): Promise<{ playback: string; thumbnail: string; storyboard: string }> {
	const signingKeyId = library.signingKeyId;
	const signingKeySecret = library.signingKeyPrivate;

	if (!signingKeyId || !signingKeySecret) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Mux signing key ID or secret not configured for this library",
		});
	}

	// Create a Mux client with JWT signing keys configured
	const muxClient = new Mux({
		tokenId: library.tokenId,
		tokenSecret: library.tokenSecret,
		jwtSigningKey: signingKeyId,
		jwtPrivateKey: signingKeySecret,
	});

	// Generate tokens for each type using Mux's JWT helpers
	const playbackToken = await muxClient.jwt.signPlaybackId(playbackId, {
		expiration: `${expiresIn}s`,
		type: "video",
	});

	// For thumbnail tokens, embed params in the JWT claims
	// Per Mux docs: time, width, height, fit_mode must be in the token, not query string
	// Convert thumbnailParams to Record<string, string> format expected by Mux SDK
	const thumbnailParamsRecord: Record<string, string> | undefined =
		thumbnailParams
			? Object.fromEntries(
					Object.entries(thumbnailParams)
						.filter(([_, value]) => value !== undefined)
						.map(([key, value]) => [key, String(value)]),
				)
			: undefined;

	const thumbnailToken = await muxClient.jwt.signPlaybackId(playbackId, {
		expiration: `${expiresIn}s`,
		type: "thumbnail",
		params: thumbnailParamsRecord,
	});

	const storyboardToken = await muxClient.jwt.signPlaybackId(playbackId, {
		expiration: `${expiresIn}s`,
		type: "storyboard",
	});

	return {
		playback: playbackToken as string,
		thumbnail: thumbnailToken as string,
		storyboard: storyboardToken as string,
	};
}

// ============================================================================
// Mapping & Transformation
// ============================================================================

export function mapMuxAssetToVideo(asset: any): MuxAsset {
	// Get the first public playback ID or create one
	const playbackId = asset.playback_ids?.[0]?.id || "";
	const policy = asset.playback_ids?.[0]?.policy || "public";

	// Extract thumbnail URL
	let thumbnail: string | undefined;
	if (asset.master?.url) {
		// Use Mux's default thumbnail URL pattern
		thumbnail = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
	}

	// Map tracks to MuxTrack interface
	const captions: MuxTrack[] = (asset.tracks || [])
		.filter((track: any) => track.type === "text")
		.map((track: any) => ({
			id: track.id,
			type: track.type,
			textType: track.text_type,
			language: track.language_code,
			languageCode: track.language_code,
			name: track.name,
			closed_captions: track.closed_captions,
		}));

	// Extract video track info for resolution
	const videoTrack = (asset.tracks || []).find((track: any) => track.type === "video");

	return {
		id: asset.id,
		playbackId,
		status: asset.status,
		title: asset.meta?.title || "Untitled",
		thumbnail,
		duration: asset.duration || 0,
		createdAt: new Date(asset.created_at * 1000).toISOString(),
		updatedAt: asset.updated_at
			? new Date(asset.updated_at * 1000).toISOString()
			: undefined,
		captions: captions.length > 0 ? captions : undefined,
		metadata: asset.meta,
		policy: policy as "public" | "signed",
		// Additional Mux asset metadata
		resolutionTier: asset.resolution_tier,
		aspectRatio: asset.aspect_ratio,
		videoQuality: asset.video_quality,
		maxStoredFrameRate: videoTrack?.max_frame_rate ?? asset.max_stored_frame_rate, // Prefer track data
		maxWidth: videoTrack?.max_width,
		maxHeight: videoTrack?.max_height,
	};
}

// ============================================================================
// String Utilities
// ============================================================================

export function createTagSlug(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}
