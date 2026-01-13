import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { t, protectedProcedure } from "../trpc-init";
import Mux from "@mux/mux-node";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, inArray, asc, desc, sql } from "drizzle-orm";
import { generateLibraryId, generateVideoId, generateTrackId, generateChapterId, generatePlaylistId, generatePlaylistItemId } from "@/worker/lib/generate-id";
import {
	muxLibrary,
	video,
	videoChapter,
	videoTrack,
	playlist,
	playlistItem,
	type MuxLibrary,
} from "@/db/video-schema";
import { encrypt, decrypt } from "@/worker/lib/encryption";


// ============================================================================
// Language Code Mapping
// ============================================================================

const LANGUAGE_NAMES: Record<string, string> = {
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

function getLanguageName(code: string): string {
	return LANGUAGE_NAMES[code] || code.toUpperCase();
}

// ============================================================================
// Encryption
// ============================================================================

/**
 * Get the encryption secret from environment
 */
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

/**
 * Encrypt sensitive library fields before storage
 */
async function encryptLibraryCredentials<
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

/**
 * Decrypt sensitive library fields after retrieval
 */
async function decryptLibraryCredentials(
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
// Types & Constants
// ============================================================================

type MuxAssetState = "preparing" | "ready" | "errored";

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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the database instance for videos
 */
function getVideosDb(env: Env) {
	return drizzle(env.DB_VIDEOS);
}

function parseTagsColumn(value?: string | null): string[] {
	if (!value) {
		return [];
	}

	try {
		const parsed = JSON.parse(value);
		if (Array.isArray(parsed)) {
			return parsed
				.map((entry) => (typeof entry === "string" ? entry.trim() : ""))
				.filter((entry) => entry.length > 0);
		}
	} catch (error) {
		console.warn("Failed to parse tags from database:", error);
	}

	return [];
}

/**
 * Get a Mux library by ID or the default library
 * Automatically decrypts sensitive credentials
 */
async function getMuxLibrary(
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

/**
 * Create a Mux client using library credentials from the database
 */
async function getMuxClient(env: Env, libraryId?: string): Promise<{ mux: Mux; library: MuxLibrary }> {
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

interface ThumbnailParams {
	time?: number;
	width?: number;
	height?: number;
	fit_mode?: string;
}

async function generateSignedTokens(
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

function mapMuxAssetToVideo(asset: any): MuxAsset {
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
// Router
// ============================================================================

export const muxRouter = t.router({
	/**
	 * List all available Mux libraries
	 */
	listLibraries: protectedProcedure.query(async ({ ctx }) => {
		const { env } = ctx;
		const db = getVideosDb(env);

		try {
			const libraries = await db
				.select({
					id: muxLibrary.id,
					name: muxLibrary.name,
					description: muxLibrary.description,
					defaultPlaybackPolicy: muxLibrary.defaultPlaybackPolicy,
					defaultVideoQuality: muxLibrary.defaultVideoQuality,
					isDefault: muxLibrary.isDefault,
					isActive: muxLibrary.isActive,
					createdAt: muxLibrary.createdAt,
					updatedAt: muxLibrary.updatedAt,
				})
				.from(muxLibrary)
				.where(eq(muxLibrary.isActive, true));

			return libraries;
		} catch (error) {
			if (error instanceof TRPCError) throw error;
			console.error("Error listing Mux libraries:", error);
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to list Mux libraries",
			});
		}
	}),

	/**
	 * Get a specific Mux library by ID
	 */
	getLibrary: protectedProcedure
		.input(z.object({ libraryId: z.string().optional() }))
		.query(async ({ ctx, input }) => {
			const { env } = ctx;

			try {
				const library = await getMuxLibrary(env, input.libraryId);
				// Return library with IDs (not secrets) for display
				return {
					id: library.id,
					name: library.name,
					description: library.description,
					muxEnvironmentId: library.muxEnvironmentId,
					tokenId: library.tokenId, // ID only, not the secret
					signingKeyId: library.signingKeyId, // ID only, not the private key
					webhookSecret: library.webhookSecret, // Displayed hidden, user can reveal
					defaultPlaybackPolicy: library.defaultPlaybackPolicy,
					defaultVideoQuality: library.defaultVideoQuality,
					isDefault: library.isDefault,
					isActive: library.isActive,
					hasSigningKey: !!(library.signingKeyId && library.signingKeyPrivate),
					createdAt: library.createdAt,
					updatedAt: library.updatedAt,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error getting Mux library:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get Mux library",
				});
			}
		}),

	/**
	 * Create a new Mux library
	 */
	createLibrary: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				description: z.string().max(500).optional(),
				muxEnvironmentId: z.string().optional(),
				tokenId: z.string().min(1),
				tokenSecret: z.string().min(1),
				signingKeyId: z.string().optional(),
				signingKeyPrivate: z.string().optional(),
				webhookSecret: z.string().optional(),
				defaultPlaybackPolicy: z
					.enum(["public", "signed"])
					.default("public"),
				defaultVideoQuality: z
					.enum(["basic", "plus", "premium"])
					.default("plus"),
				isDefault: z.boolean().default(false),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);

			try {
				const id = generateLibraryId();

				// If this is set as default, unset any existing default
				if (input.isDefault) {
					await db
						.update(muxLibrary)
						.set({ isDefault: false })
						.where(eq(muxLibrary.isDefault, true));
				}

				// Encrypt sensitive credentials before storing
				const encryptedCredentials = await encryptLibraryCredentials(
					{
						tokenId: input.tokenId,
						tokenSecret: input.tokenSecret,
						signingKeyId: input.signingKeyId,
						signingKeyPrivate: input.signingKeyPrivate,
						webhookSecret: input.webhookSecret,
					},
					env,
				);

				const [newLibrary] = await db
					.insert(muxLibrary)
					.values({
						id,
						name: input.name,
						description: input.description,
						muxEnvironmentId: input.muxEnvironmentId,
						tokenId: encryptedCredentials.tokenId,
						tokenSecret: encryptedCredentials.tokenSecret,
						signingKeyId: encryptedCredentials.signingKeyId,
						signingKeyPrivate: encryptedCredentials.signingKeyPrivate,
						webhookSecret: encryptedCredentials.webhookSecret,
						defaultPlaybackPolicy: input.defaultPlaybackPolicy,
						defaultVideoQuality: input.defaultVideoQuality,
						isDefault: input.isDefault,
						isActive: true,
					})
					.returning({
						id: muxLibrary.id,
						name: muxLibrary.name,
						description: muxLibrary.description,
						defaultPlaybackPolicy: muxLibrary.defaultPlaybackPolicy,
						defaultVideoQuality: muxLibrary.defaultVideoQuality,
						isDefault: muxLibrary.isDefault,
						isActive: muxLibrary.isActive,
						createdAt: muxLibrary.createdAt,
						updatedAt: muxLibrary.updatedAt,
					});

				return newLibrary;
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error creating Mux library:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create Mux library",
				});
			}
		}),

	/**
	 * Update a Mux library
	 */
	updateLibrary: protectedProcedure
		.input(
			z.object({
				libraryId: z.string(),
				name: z.string().min(1).max(100).optional(),
				description: z.string().max(500).optional().nullable(),
				muxEnvironmentId: z.string().optional().nullable(),
				tokenId: z.string().min(1).optional(),
				tokenSecret: z.string().min(1).optional(),
				signingKeyId: z.string().optional().nullable(),
				signingKeyPrivate: z.string().optional().nullable(),
				webhookSecret: z.string().optional().nullable(),
				defaultPlaybackPolicy: z
					.enum(["public", "signed"])
					.optional(),
				defaultVideoQuality: z
					.enum(["basic", "plus", "premium"])
					.optional(),
				isDefault: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);

			try {
				// Check if library exists
				const existing = await db
					.select()
					.from(muxLibrary)
					.where(eq(muxLibrary.id, input.libraryId))
					.limit(1);

				if (!existing[0]) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: `Library with ID ${input.libraryId} not found`,
					});
				}

				// If this is set as default, unset any existing default
				if (input.isDefault) {
					await db
						.update(muxLibrary)
						.set({ isDefault: false })
						.where(eq(muxLibrary.isDefault, true));
				}

				// Encrypt any credential fields being updated
				const encryptedCredentials = await encryptLibraryCredentials(
					{
						tokenId: input.tokenId,
						tokenSecret: input.tokenSecret,
						signingKeyId: input.signingKeyId,
						signingKeyPrivate: input.signingKeyPrivate,
						webhookSecret: input.webhookSecret,
					},
					env,
				);

				// Build update object with only provided fields
				const updateData: Partial<typeof muxLibrary.$inferInsert> = {};
				if (input.name !== undefined) updateData.name = input.name;
				if (input.description !== undefined)
					updateData.description = input.description;
				if (input.muxEnvironmentId !== undefined)
					updateData.muxEnvironmentId = input.muxEnvironmentId;
				if (input.tokenId !== undefined)
					updateData.tokenId = encryptedCredentials.tokenId;
				if (input.tokenSecret !== undefined)
					updateData.tokenSecret = encryptedCredentials.tokenSecret;
				if (input.signingKeyId !== undefined)
					updateData.signingKeyId = encryptedCredentials.signingKeyId;
				if (input.signingKeyPrivate !== undefined)
					updateData.signingKeyPrivate = encryptedCredentials.signingKeyPrivate;
				if (input.webhookSecret !== undefined)
					updateData.webhookSecret = encryptedCredentials.webhookSecret;
				if (input.defaultPlaybackPolicy !== undefined)
					updateData.defaultPlaybackPolicy = input.defaultPlaybackPolicy;
				if (input.defaultVideoQuality !== undefined)
					updateData.defaultVideoQuality = input.defaultVideoQuality;
				if (input.isDefault !== undefined)
					updateData.isDefault = input.isDefault;

				const [updatedLibrary] = await db
					.update(muxLibrary)
					.set(updateData)
					.where(eq(muxLibrary.id, input.libraryId))
					.returning({
						id: muxLibrary.id,
						name: muxLibrary.name,
						description: muxLibrary.description,
						defaultPlaybackPolicy: muxLibrary.defaultPlaybackPolicy,
						defaultVideoQuality: muxLibrary.defaultVideoQuality,
						isDefault: muxLibrary.isDefault,
						isActive: muxLibrary.isActive,
						createdAt: muxLibrary.createdAt,
						updatedAt: muxLibrary.updatedAt,
					});

				return updatedLibrary;
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error updating Mux library:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update Mux library",
				});
			}
		}),

	/**
	 * Delete a Mux library
	 */
	deleteLibrary: protectedProcedure
		.input(z.object({ libraryId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);

			try {
				// Check if library exists
				const existing = await db
					.select()
					.from(muxLibrary)
					.where(eq(muxLibrary.id, input.libraryId))
					.limit(1);

				if (!existing[0]) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: `Library with ID ${input.libraryId} not found`,
					});
				}

				// Delete the library from the database
				await db
					.delete(muxLibrary)
					.where(eq(muxLibrary.id, input.libraryId));

				return { success: true };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error deleting Mux library:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete Mux library",
				});
			}
		}),

	/**
	 * Test Mux library credentials
	 */
	testLibraryCredentials: protectedProcedure
		.input(
			z.object({
				tokenId: z.string().min(1),
				tokenSecret: z.string().min(1),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				const mux = new Mux({
					tokenId: input.tokenId,
					tokenSecret: input.tokenSecret,
				});

				// Try to list assets to verify credentials work
				await mux.video.assets.list({ limit: 1 });

				return { success: true, message: "Credentials are valid" };
			} catch (error) {
				console.error("Error testing Mux credentials:", error);
				return {
					success: false,
					message: "Invalid credentials or unable to connect to Mux",
				};
			}
		}),

	/**
	 * Get all assets from Mux
	 */
	listAssets: protectedProcedure
		.input(
			z
				.object({
					libraryId: z.string().optional(),
					limit: z.number().min(1).max(100).default(25),
					page: z.number().min(1).default(1),
				})
				.optional(),
		)
		.query(async ({ ctx, input }): Promise<MuxAsset[]> => {
			const { env } = ctx;
			const libraryId = input?.libraryId;
			const limit = input?.limit ?? 25;
			const page = input?.page ?? 1;

			try {
				const { mux, library } = await getMuxClient(env, libraryId);
				const db = getVideosDb(env);
				const assets = await mux.video.assets.list({
					limit,
					page,
				});

				const muxAssets = (assets.data || []).map(mapMuxAssetToVideo);

				// Get all mux asset IDs
				const muxAssetIds = muxAssets.map((asset) => asset.id);

				// Fetch view counts and published status from database for these assets
				if (muxAssetIds.length > 0) {
					const videoMetadata = await db
						.select({
							muxAssetId: video.muxAssetId,
							viewCount: video.viewCount,
							isPublished: video.isPublished,
						})
						.from(video)
						.where(
							and(
								eq(video.libraryId, library.id),
								inArray(video.muxAssetId, muxAssetIds),
								eq(video.isDeleted, false),
							),
						);

					// Create a map for quick lookup
					const videoMetadataMap = new Map<string, { viewCount: number; isPublished: boolean }>();
					for (const record of videoMetadata) {
						videoMetadataMap.set(record.muxAssetId, {
							viewCount: record.viewCount ?? 0,
							isPublished: record.isPublished,
						});
					}

					// Enrich assets with view counts and published status
					return muxAssets.map((asset) => {
						const metadata = videoMetadataMap.get(asset.id);
						return {
							...asset,
							views: metadata?.viewCount ?? 0,
							isPublished: metadata?.isPublished ?? false,
						};
					});
				}

				return muxAssets;
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error listing Mux assets:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to list assets from Mux",
				});
			}
		}),

	/**
	 * Get a single asset by ID
	 */
	getAsset: protectedProcedure
		.input(z.object({ assetId: z.string(), libraryId: z.string().optional() }))
		.query(async ({ ctx, input }): Promise<MuxAsset> => {
			const { env } = ctx;

			try {
				const { mux } = await getMuxClient(env, input.libraryId);
				const asset = await mux.video.assets.retrieve(input.assetId);

				return mapMuxAssetToVideo(asset);
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error fetching Mux asset:", error);
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Asset ${input.assetId} not found`,
				});
			}
		}),

	/**
	 * Update an asset (title, metadata)
	 */
	updateAsset: protectedProcedure
		.input(
			z.object({
				assetId: z.string(),
				libraryId: z.string().optional(),
				title: z.string().optional(),
				metadata: z.record(z.string(), z.unknown()).optional(),
			}),
		)
		.mutation(async ({ ctx, input }): Promise<MuxAsset> => {
			const { env } = ctx;

			try {
				const { mux } = await getMuxClient(env, input.libraryId);
				
				// Build the meta object, merging title and custom metadata
				const meta: Record<string, unknown> = { ...input.metadata };
				if (input.title !== undefined) {
					meta.title = input.title;
				}

				const asset = await mux.video.assets.update(input.assetId, {
					meta: Object.keys(meta).length > 0 ? meta : undefined,
				});

				return mapMuxAssetToVideo(asset);
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error updating Mux asset:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update asset",
				});
			}
		}),

	/**
	 * Update video metadata in local database
	 */
	updateVideoMetadata: protectedProcedure
		.input(
			z.object({
				muxAssetId: z.string(),
				libraryId: z.string().optional(),
				title: z.string().optional(),
				description: z.string().optional(),
				isPublished: z.boolean().optional(),
				publishedAt: z.string().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
			const { env } = ctx;
			const db = getVideosDb(env);

			try {
				const { library } = await getMuxClient(env, input.libraryId);

				// Find the video in the database
				const existingVideo = await db
					.select()
					.from(video)
					.where(
						and(
							eq(video.libraryId, library.id),
							eq(video.muxAssetId, input.muxAssetId),
						),
					)
					.limit(1);

				if (existingVideo.length === 0) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Video not found in database",
					});
				}

				// Build update object with only provided fields
				const updateData: Partial<typeof video.$inferInsert> = {};
				if (input.title !== undefined) {
					updateData.title = input.title;
				}
				if (input.description !== undefined) {
					updateData.description = input.description;
				}
				if (input.isPublished !== undefined) {
					updateData.isPublished = input.isPublished;
				}
				if (input.publishedAt !== undefined) {
					updateData.publishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
				}

				// Only update if there are fields to update
				if (Object.keys(updateData).length === 0) {
					return { success: true };
				}

				// Update the database record
				await db
					.update(video)
					.set(updateData)
					.where(eq(video.id, existingVideo[0].id));

				return { success: true };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error updating video metadata:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update video metadata",
				});
			}
		}),

	/**
	 * Get video metadata from local database
	 */
	getVideoFromDatabase: protectedProcedure
		.input(z.object({ muxAssetId: z.string(), libraryId: z.string().optional() }))
		.query(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);

			try {
				const { library } = await getMuxClient(env, input.libraryId);

				const [videoRecord] = await db
					.select({
						id: video.id,
						title: video.title,
						description: video.description,
						muxAssetId: video.muxAssetId,
						muxPlaybackId: video.muxPlaybackId,
						status: video.status,
						duration: video.duration,
						viewCount: video.viewCount,
						isPublished: video.isPublished,
						publishedAt: video.publishedAt,
						viewCountSyncedAt: video.viewCountSyncedAt,
						createdAt: video.createdAt,
						updatedAt: video.updatedAt,
					})
					.from(video)
					.where(
						and(
							eq(video.libraryId, library.id),
							eq(video.muxAssetId, input.muxAssetId),
						),
					)
					.limit(1);

				if (!videoRecord) {
					return null;
				}

				return videoRecord;
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error getting video from database:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get video from database",
				});
			}
		}),

	/**
	 * Get video tracks (captions, audio, etc.) from local database
	 */
	getVideoTracks: protectedProcedure
		.input(z.object({ muxAssetId: z.string(), libraryId: z.string().optional() }))
		.query(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);

			try {
				const { library } = await getMuxClient(env, input.libraryId);

				// First find the video
				const [videoRecord] = await db
					.select({ id: video.id })
					.from(video)
					.where(
						and(
							eq(video.libraryId, library.id),
							eq(video.muxAssetId, input.muxAssetId),
						),
					)
					.limit(1);

				if (!videoRecord) {
					return [];
				}

				// Fetch all tracks for this video
				const tracks = await db
					.select({
						id: videoTrack.id,
						muxTrackId: videoTrack.muxTrackId,
						trackCategory: videoTrack.trackCategory,
						textCategory: videoTrack.textCategory,
						languageCode: videoTrack.languageCode,
						name: videoTrack.name,
						status: videoTrack.status,
						textSource: videoTrack.textSource,
						closedCaptions: videoTrack.closedCaptions,
						isPrimary: videoTrack.isPrimary,
						createdAt: videoTrack.createdAt,
						updatedAt: videoTrack.updatedAt,
					})
					.from(videoTrack)
					.where(eq(videoTrack.videoId, videoRecord.id));

				return tracks;
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error getting video tracks:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get video tracks",
				});
			}
		}),

	/**
	 * Check if a video is synced to the local database
	 */
	getVideoSyncStatus: protectedProcedure
		.input(z.object({ muxAssetId: z.string(), libraryId: z.string().optional() }))
		.query(async ({ ctx, input }): Promise<{ isSynced: boolean; videoId?: string }> => {
			const { env } = ctx;
			const db = getVideosDb(env);

			try {
				const { library } = await getMuxClient(env, input.libraryId);

				const existingVideo = await db
					.select({ id: video.id })
					.from(video)
					.where(
						and(
							eq(video.libraryId, library.id),
							eq(video.muxAssetId, input.muxAssetId),
						),
					)
					.limit(1);

				return {
					isSynced: existingVideo.length > 0,
					videoId: existingVideo[0]?.id,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error checking video sync status:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to check video sync status",
				});
			}
		}),

	/**
	 * Sync a single asset from Mux to the local database
	 */
	syncSingleAsset: protectedProcedure
		.input(z.object({ muxAssetId: z.string(), libraryId: z.string().optional() }))
		.mutation(async ({ ctx, input }): Promise<{ success: boolean; videoId: string }> => {
			const { env } = ctx;
			const db = getVideosDb(env);

			try {
				const { mux, library } = await getMuxClient(env, input.libraryId);

				// Check if already synced
				const existingVideo = await db
					.select({ id: video.id, externalId: video.externalId })
					.from(video)
					.where(
						and(
							eq(video.libraryId, library.id),
							eq(video.muxAssetId, input.muxAssetId),
						),
					)
					.limit(1);

				if (existingVideo.length > 0) {
					const existingId = existingVideo[0].id;
					
					// Even if already synced locally, ensure Mux has our external_id
					try {
						await mux.video.assets.update(input.muxAssetId, {
							meta: {
								external_id: existingId,
							},
						});
					} catch (updateError) {
						console.warn("Failed to update Mux asset with external ID:", updateError);
					}
					
					// Also update our database if externalId isn't set
					if (!existingVideo[0].externalId) {
						await db
							.update(video)
							.set({ externalId: existingId })
							.where(eq(video.id, existingId));
					}
					
					return { success: true, videoId: existingId };
				}

				// Fetch the asset from Mux
				const asset = await mux.video.assets.retrieve(input.muxAssetId);

				const playbackId = asset.playback_ids?.[0]?.id || null;
				const playbackPolicy =
					(asset.playback_ids?.[0]?.policy as "public" | "signed") ||
					library.defaultPlaybackPolicy;

				const newVideoId = generateVideoId();

				// Store the title, preserving existing title if any
				const title = asset.meta?.title || asset.passthrough || "Untitled";

				// Get dimensions from video track (max_stored_resolution is deprecated)
				const videoTrackData = asset.tracks?.find((t) => t.type === "video");
				const maxWidth = videoTrackData?.max_width ?? null;
				const maxHeight = videoTrackData?.max_height ?? null;

				await db.insert(video).values({
					id: newVideoId,
					libraryId: library.id,
					muxAssetId: asset.id,
					muxPlaybackId: playbackId,
					muxUploadId: asset.upload_id ?? null,
					status: asset.status as "preparing" | "ready" | "errored",
					title,
					duration: asset.duration || null,
					aspectRatio: asset.aspect_ratio || null,
					maxWidth,
					maxHeight,
					maxFrameRate: videoTrackData?.max_frame_rate ?? null,
					resolutionTier: asset.resolution_tier as
						| "audio-only"
						| "720p"
						| "1080p"
						| "1440p"
						| "2160p"
						| null,
					videoQuality:
						(asset.video_quality as "basic" | "plus" | "premium") ||
						library.defaultVideoQuality,
					playbackPolicy,
					passthrough: newVideoId, // Store our internal ID as passthrough
					externalId: newVideoId, // Also store in externalId field
					ingestCategory: asset.ingest_type as
						| "on_demand_url"
						| "on_demand_direct_upload"
						| "on_demand_clip"
						| "live_rtmp"
						| "live_srt"
						| null,
					isTest: asset.test || false,
					createdAt: asset.created_at ? new Date(Number(asset.created_at) * 1000) : new Date(),
					updatedAt: new Date(),
				});

				// Update Mux asset with our internal video ID in meta.external_id
				// This creates a two-way link between our database and Mux
				try {
					await mux.video.assets.update(input.muxAssetId, {
						meta: {
							external_id: newVideoId,
						},
					});
				} catch (updateError) {
					// Log but don't fail - the local sync succeeded
					console.warn("Failed to update Mux asset with external ID:", updateError);
				}

				return { success: true, videoId: newVideoId };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error syncing single asset:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to sync asset to database",
				});
			}
		}),

	/**
	 * Delete an asset
	 */
	deleteAsset: protectedProcedure
		.input(z.object({ assetId: z.string(), libraryId: z.string().optional() }))
		.mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
			const { env } = ctx;

			try {
				const { mux } = await getMuxClient(env, input.libraryId);
				const db = getVideosDb(env);

				// Delete from Mux first
				await mux.video.assets.delete(input.assetId);

				// Then delete from database (soft delete)
				await db
					.update(video)
					.set({
						isDeleted: true,
						deletedAt: new Date(),
					})
					.where(eq(video.muxAssetId, input.assetId));

				return { success: true };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error deleting Mux asset:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete asset",
				});
			}
		}),

	/**
	 * Create a direct upload URL for resumable uploads
	 */
	createDirectUpload: protectedProcedure
		.input(
			z.object({
				libraryId: z.string().optional(),
				corsOrigin: z.string(),
				timeout: z.number().min(60).max(604800).default(3600),
				title: z.string().optional(),
				metadata: z.record(z.string(), z.unknown()).optional(),
				// Optional video quality override (defaults to library setting)
				videoQuality: z.enum(['basic', 'plus', 'premium']).optional(),
				// Optional playback policy override (defaults to library setting)
				playbackPolicy: z.enum(['public', 'signed']).optional(),
				// Optional auto-generated captions
				autoCaptions: z.object({
					enabled: z.boolean(),
					languageCode: z.enum([
						'en', 'es', 'it', 'pt', 'de', 'fr', 'pl', 'ru', 'nl', 'ca',
						'tr', 'sv', 'uk', 'no', 'fi', 'sk', 'el', 'cs', 'hr', 'da', 'ro', 'bg'
					]).default('en'),
				}).optional(),
			}),
		)
		.mutation(async ({ ctx, input }): Promise<DirectUpload> => {
			const { env } = ctx;

			try {
				const { mux, library } = await getMuxClient(env, input.libraryId);
				
				// Use library defaults for playback policy and video quality
				// Allow per-upload playback policy override, fallback to library default
				const playbackPolicy = input.playbackPolicy || library.defaultPlaybackPolicy || "public";
				// Allow per-upload video quality override, fallback to library default
				const videoQuality = input.videoQuality || library.defaultVideoQuality || "basic";
				
				// Build meta object with title if provided
				const meta: { title?: string; [key: string]: unknown } = {};
				if (input.title) {
					meta.title = input.title;
				}
				// Merge any additional metadata
				if (input.metadata) {
					Object.assign(meta, input.metadata);
				}
				
				// Build inputs array for auto-generated captions if enabled
				const languageCode = input.autoCaptions?.languageCode ?? 'en';
				const inputs = input.autoCaptions?.enabled
					? [
							{
								generated_subtitles: [
									{
										language_code: languageCode,
										name: `${getLanguageName(languageCode)} CC`,
									},
								],
							},
						]
					: undefined;

				const upload = await mux.video.uploads.create({
					cors_origin: input.corsOrigin,
					timeout: input.timeout,
					new_asset_settings: {
						playback_policies: [playbackPolicy],
						video_quality: videoQuality,
						meta: Object.keys(meta).length > 0 ? meta : undefined,
						inputs,
					},
				});

				return {
					id: upload.id,
					url: upload.url,
					status: upload.status,
					timeout: upload.timeout,
					assetId: upload.asset_id,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error creating direct upload:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create direct upload",
				});
			}
		}),

	/**
	 * Get direct upload status
	 */
	getDirectUpload: protectedProcedure
		.input(z.object({ uploadId: z.string(), libraryId: z.string().optional() }))
		.query(async ({ ctx, input }): Promise<DirectUpload> => {
			const { env } = ctx;

			try {
				const { mux } = await getMuxClient(env, input.libraryId);
				const upload = await mux.video.uploads.retrieve(input.uploadId);

				return {
					id: upload.id,
					url: upload.url,
					status: upload.status,
					timeout: upload.timeout,
					assetId: upload.asset_id,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error retrieving direct upload:", error);
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Upload ${input.uploadId} not found`,
				});
			}
		}),

	/**
	 * Create a playback ID for an asset
	 */
	createPlaybackId: protectedProcedure
		.input(
			z.object({
				assetId: z.string(),
				libraryId: z.string().optional(),
				policy: z.enum(["public", "signed"]).default("public"),
			}),
		)
		.mutation(
			async ({
				ctx,
				input,
			}): Promise<{ playbackId: string; policy: string }> => {
				const { env } = ctx;

				try {
					const { mux } = await getMuxClient(env, input.libraryId);
					const playbackId = await mux.video.assets.createPlaybackId(
						input.assetId,
						{ policy: input.policy },
					);

					return {
						playbackId: playbackId.id,
						policy: input.policy,
					};
				} catch (error) {
					if (error instanceof TRPCError) throw error;
					console.error("Error creating playback ID:", error);
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to create playback ID",
					});
				}
			},
		),

	/**
	 * Add a caption or subtitle track to an asset
	 */
	addCaption: protectedProcedure
		.input(
			z.object({
				assetId: z.string(),
				libraryId: z.string().optional(),
				url: z.string().url(),
				language: z.string(),
				textType: z.enum(["subtitles"]).default("subtitles"),
				name: z.string().optional(),
				closedCaptions: z.boolean().default(false),
			}),
		)
		.mutation(async ({ ctx, input }): Promise<MuxTrack> => {
			const { env } = ctx;

			try {
				const { mux } = await getMuxClient(env, input.libraryId);
				const track = await mux.video.assets.createTrack(input.assetId, {
					url: input.url,
					type: "text",
					text_type: input.textType as "subtitles",
					language_code: input.language,
					name: input.name,
					closed_captions: input.closedCaptions,
				});

				return {
					id: track.id ?? "",
					type: track.type ?? "text",
					textType: track.text_type,
					language: track.language_code,
					name: track.name,
					closed_captions: track.closed_captions,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error adding caption:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to add caption",
				});
			}
		}),

	/**
	 * Delete a caption or subtitle track
	 */
	deleteCaption: protectedProcedure
		.input(z.object({ assetId: z.string(), trackId: z.string(), libraryId: z.string().optional() }))
		.mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
			const { env } = ctx;
			const db = getVideosDb(env);

			try {
				const { mux } = await getMuxClient(env, input.libraryId);
				await mux.video.assets.deleteTrack(input.assetId, input.trackId);
				
				// Also delete from our database if it exists
				await db
					.delete(videoTrack)
					.where(eq(videoTrack.muxTrackId, input.trackId));
				
				return { success: true };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error deleting caption:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete caption",
				});
			}
		}),

	/**
	 * Generate auto-captions for an existing asset using Mux's ASR
	 * This uses OpenAI's Whisper model to generate captions from the audio track
	 */
	generateCaptions: protectedProcedure
		.input(
			z.object({
				assetId: z.string(),
				libraryId: z.string().optional(),
				languageCode: z.enum([
					'en', 'es', 'it', 'pt', 'de', 'fr', 'pl', 'ru', 'nl', 'ca',
					'tr', 'sv', 'uk', 'no', 'fi', 'sk', 'el', 'cs', 'hr', 'da', 'ro', 'bg'
				]).default('en'),
			}),
		)
		.mutation(async ({ ctx, input }): Promise<{ success: boolean; trackId?: string; message: string }> => {
			const { env } = ctx;
			const db = getVideosDb(env);

			try {
				const { mux, library } = await getMuxClient(env, input.libraryId);
				
				// First, get the asset to find the audio track ID
				const asset = await mux.video.assets.retrieve(input.assetId);
				
				if (asset.status !== 'ready') {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Asset must be in 'ready' status before generating captions",
					});
				}
				
				// Find the audio track
				const audioTrack = asset.tracks?.find((track) => track.type === 'audio');
				
				if (!audioTrack?.id) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "No audio track found on this asset",
					});
				}

				// Generate the caption name based on language
				const languageName = getLanguageName(input.languageCode);
				const captionName = `${languageName} (auto-generated)`;

				// Call Mux API to generate subtitles
				// POST /video/v1/assets/${ASSET_ID}/tracks/${AUDIO_TRACK_ID}/generate-subtitles
				const response = await fetch(
					`https://api.mux.com/video/v1/assets/${input.assetId}/tracks/${audioTrack.id}/generate-subtitles`,
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Basic ${btoa(`${library.tokenId}:${library.tokenSecret}`)}`,
						},
						body: JSON.stringify({
							generated_subtitles: [
								{
									language_code: input.languageCode,
									name: captionName,
								},
							],
						}),
					}
				);

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}));
					console.error("Mux generate-subtitles error:", errorData);
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: `Failed to generate captions: ${(errorData as { error?: { messages?: string[] } }).error?.messages?.[0] || response.statusText}`,
					});
				}

				const result = await response.json() as { data: Array<{ id: string }> };
				const generatedTrack = result.data?.[0];

				// Save the track to our database with "preparing" status
				if (generatedTrack?.id) {
					// Find the video in our database
					const [videoRecord] = await db
						.select({ id: video.id })
						.from(video)
						.where(
							and(
								eq(video.libraryId, library.id),
								eq(video.muxAssetId, input.assetId),
							),
						)
						.limit(1);

					if (videoRecord) {
						const trackId = generateTrackId();
						await db.insert(videoTrack).values({
							id: trackId,
							videoId: videoRecord.id,
							muxTrackId: generatedTrack.id,
							trackCategory: "text",
							textCategory: "subtitles",
							textSource: "generated_vod",
							languageCode: input.languageCode,
							name: captionName,
							status: "preparing",
							closedCaptions: false,
							isPrimary: false,
							createdAt: new Date(),
							updatedAt: new Date(),
						});
					}
				}

				return {
					success: true,
					trackId: generatedTrack?.id,
					message: `Caption generation started for ${languageName}. This may take a few minutes depending on the video length.`,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error generating captions:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to generate captions",
				});
			}
		}),

	/**
	 * Get assets by collection/tag (using metadata filtering)
	 * Since Mux doesn't have native collections, we filter by metadata
	 */
	getAssetsByCollection: protectedProcedure
		.input(z.object({ collectionId: z.string(), libraryId: z.string().optional() }))
		.query(async ({ ctx, input }): Promise<MuxAsset[]> => {
			const { env } = ctx;

			try {
				const { mux } = await getMuxClient(env, input.libraryId);
				// List all assets and filter client-side by metadata
				const assets = await mux.video.assets.list({ limit: 100 });

				const filtered = (assets.data || []).filter((asset: any) => {
					return asset.meta?.collectionId === input.collectionId;
				});

				return filtered.map(mapMuxAssetToVideo);
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error getting assets by collection:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get assets",
				});
			}
		}),

	/**
	 * Generate signed tokens for secure video playback
	 */
	generateSignedTokens: protectedProcedure
		.input(
			z.object({
				playbackId: z.string(),
				libraryId: z.string().optional(),
				expiresIn: z.number().default(3600),
				// Thumbnail params to embed in the JWT token (for signed videos)
				thumbnailParams: z.object({
					time: z.number().optional(),
					width: z.number().optional(),
					height: z.number().optional(),
					fit_mode: z.string().optional(),
				}).optional(),
			}),
		)
		.query(
			async ({
				ctx,
				input,
			}): Promise<{
				playback: string;
				thumbnail: string;
				storyboard: string;
			}> => {
				const { env } = ctx;

				try {
					const library = await getMuxLibrary(env, input.libraryId);
					return await generateSignedTokens(
						input.playbackId,
						library,
						input.expiresIn,
						input.thumbnailParams,
					);
				} catch (error) {
					if (error instanceof TRPCError) throw error;
					console.error("Error generating signed tokens:", error);
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to generate signed tokens",
					});
				}
			},
		),

	/**
	 * Create a signed URL for playback (for signed playback policies)
	 */
	createSignedUrl: protectedProcedure
		.input(
			z.object({
				playbackId: z.string(),
				libraryId: z.string().optional(),
				expiresIn: z.number().default(3600),
			}),
		)
		.query(async ({ ctx, input }): Promise<{ url: string; token?: string }> => {
			const { env } = ctx;

			try {
				const library = await getMuxLibrary(env, input.libraryId);
				
				// For signed playback, generate a signed URL with JWT token
				if (library.signingKeyId && library.signingKeyPrivate) {
					const tokens = await generateSignedTokens(
						input.playbackId,
						library,
						input.expiresIn,
					);
					return {
						url: `https://stream.mux.com/${input.playbackId}`,
						token: tokens.playback,
					};
				}

				// For public playback, return the standard URL
				return {
					url: `https://stream.mux.com/${input.playbackId}`,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error creating signed URL:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create signed URL",
				});
			}
		}),

	/**
	 * Sync assets from Mux to the local database
	 * This is useful for importing videos that were uploaded directly to Mux
	 */
	syncMuxAssets: protectedProcedure
		.input(
			z.object({
				libraryId: z.string().optional(),
			}),
		)
		.mutation(
			async ({
				ctx,
				input,
			}): Promise<{ synced: number; updated: number; total: number }> => {
				const { env } = ctx;
				const db = getVideosDb(env);

				try {
					const { mux, library } = await getMuxClient(env, input.libraryId);

					// Fetch all assets from Mux (paginated)
					const allMuxAssets: any[] = [];
					let page = 1;
					const limit = 100;

					while (true) {
						const assets = await mux.video.assets.list({ limit, page });
						if (!assets.data || assets.data.length === 0) break;
						allMuxAssets.push(...assets.data);
						if (assets.data.length < limit) break;
						page++;
					}

					if (allMuxAssets.length === 0) {
						return { synced: 0, updated: 0, total: 0 };
					}

					// Get all muxAssetIds that already exist in our database for this library
					const muxAssetIds = allMuxAssets.map((a) => a.id);
					const existingVideos = await db
						.select({ id: video.id, muxAssetId: video.muxAssetId, externalId: video.externalId })
						.from(video)
						.where(
							and(
								eq(video.libraryId, library.id),
								inArray(video.muxAssetId, muxAssetIds),
							),
						);

					const existingMuxAssetIds = new Set(
						existingVideos.map((v) => v.muxAssetId),
					);

					// For existing videos, ensure Mux has the external_id set
					const existingUpdatePromises = existingVideos.map(async (v) => {
						try {
							await mux.video.assets.update(v.muxAssetId, {
								meta: {
									external_id: v.id,
								},
							});
							// Also update our database if externalId isn't set
							if (!v.externalId) {
								await db
									.update(video)
									.set({ externalId: v.id })
									.where(eq(video.id, v.id));
							}
						} catch (updateError) {
							console.warn(`Failed to update existing Mux asset ${v.muxAssetId} with external ID:`, updateError);
						}
					});
					await Promise.allSettled(existingUpdatePromises);

					// Filter to only assets that don't exist in the database
					const assetsToSync = allMuxAssets.filter(
						(asset) => !existingMuxAssetIds.has(asset.id),
					);

					if (assetsToSync.length === 0) {
						return {
							synced: 0,
							updated: existingVideos.length,
							total: allMuxAssets.length,
						};
					}

					// Prepare videos to insert with generated IDs
					const videosToInsert = assetsToSync.map((asset) => {
						const playbackId = asset.playback_ids?.[0]?.id || null;
						const playbackPolicy =
							(asset.playback_ids?.[0]?.policy as
								| "public"
								| "signed" ) || library.defaultPlaybackPolicy;

						const newVideoId = generateVideoId();

						// Get dimensions from video track (max_stored_resolution is deprecated)
						const videoTrackData = asset.tracks?.find((t: { type: string }) => t.type === "video");

						return {
							id: newVideoId,
							libraryId: library.id,
							muxAssetId: asset.id,
							muxPlaybackId: playbackId,
							muxUploadId: asset.upload_id ?? null,
							status: asset.status as "preparing" | "ready" | "errored",
							title: asset.meta?.title || asset.passthrough || "Untitled",
							duration: asset.duration || null,
							aspectRatio: asset.aspect_ratio || null,
							maxWidth: videoTrackData?.max_width ?? null,
							maxHeight: videoTrackData?.max_height ?? null,
							maxFrameRate: videoTrackData?.max_frame_rate ?? null,
							resolutionTier: asset.resolution_tier as "audio-only" | "720p" | "1080p" | "1440p" | "2160p" | null,
							videoQuality: (asset.video_quality as "basic" | "plus" | "premium") || library.defaultVideoQuality,
							playbackPolicy,
							passthrough: newVideoId, // Store our internal ID as passthrough
							externalId: newVideoId, // Also store in externalId field
							ingestCategory: asset.ingest_type as "on_demand_url" | "on_demand_direct_upload" | "on_demand_clip" | "live_rtmp" | "live_srt" | null,
							isTest: asset.test || false,
							createdAt: asset.created_at ? new Date(Number(asset.created_at) * 1000) : new Date(),
							updatedAt: new Date(),
						};
					});

					// Batch insert videos into database
					await db.insert(video).values(videosToInsert);

					// Update Mux assets with our internal video IDs (meta.external_id field)
					// This creates a two-way link between our database and Mux
					const updatePromises = videosToInsert.map(async (v) => {
						try {
							await mux.video.assets.update(v.muxAssetId, {
								meta: {
									external_id: v.id,
								},
							});
						} catch (updateError) {
							// Log but don't fail - the local sync succeeded
							console.warn(`Failed to update Mux asset ${v.muxAssetId} with external ID:`, updateError);
						}
					});

					// Wait for all Mux updates (but don't fail if some don't work)
					await Promise.allSettled(updatePromises);

					return {
						synced: assetsToSync.length,
						updated: existingVideos.length,
						total: allMuxAssets.length,
					};
				} catch (error) {
					if (error instanceof TRPCError) throw error;
					console.error("Error syncing Mux assets:", error);
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to sync assets from Mux",
					});
				}
			},
		),

	/**
	 * Get view count for a specific asset from Mux Data API
	 * This performs incremental syncing - it fetches views since the last sync
	 * and accumulates them into the stored total for lifetime tracking.
	 *
	 * Mux Data only retains data for 100 days, so we store cumulative totals
	 * in our database to maintain lifetime view counts.
	 */
	getAssetViewCount: protectedProcedure
		.input(
			z.object({
				libraryId: z.string(),
				muxAssetId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { env } = ctx;
			const { libraryId, muxAssetId } = input;

			const db = getVideosDb(env);

			try {
				// Get the current stored video record
				const [videoRecord] = await db
					.select({
						id: video.id,
						viewCount: video.viewCount,
						viewCountSyncedAt: video.viewCountSyncedAt,
						totalWatchTimeMs: video.totalWatchTimeMs,
					})
					.from(video)
					.where(and(eq(video.muxAssetId, muxAssetId), eq(video.libraryId, libraryId)))
					.limit(1);

				// If no video record exists in our DB, just fetch from Mux without storing
				if (!videoRecord) {
					const { mux } = await getMuxClient(env, libraryId);
					const response = await mux.data.metrics.getOverallValues("views", {
						filters: [`asset_id:${muxAssetId}`],
						timeframe: ["90:days"],
					});

					return {
						muxAssetId,
						views: response.data?.total_views ?? 0,
						totalWatchTime: response.data?.total_watch_time ?? null,
						totalPlayingTime: response.data?.total_playing_time ?? null,
						source: "mux-only" as const,
					};
				}

				const { mux } = await getMuxClient(env, libraryId);
				const now = Date.now();
				const lastSyncAt = videoRecord.viewCountSyncedAt?.getTime() ?? null;

				// Determine the timeframe to query
				// If we have a last sync time, get views since then
				// Otherwise, get all available data (up to 90 days)
				let timeframeParam: string[];
				if (lastSyncAt) {
					// Query from last sync to now using epoch timestamps
					const lastSyncEpoch = Math.floor(lastSyncAt / 1000);
					const nowEpoch = Math.floor(now / 1000);
					timeframeParam = [String(lastSyncEpoch), String(nowEpoch)];
				} else {
					// First sync - get maximum available data (90 days)
					timeframeParam = ["90:days"];
				}

				const response = await mux.data.metrics.getOverallValues("views", {
					filters: [`asset_id:${muxAssetId}`],
					timeframe: timeframeParam,
				});

				const newViews = response.data?.total_views ?? 0;
				const newWatchTime = response.data?.total_watch_time ?? 0;

				// Calculate cumulative totals
				const storedViewCount = videoRecord.viewCount ?? 0;
				const storedWatchTime = videoRecord.totalWatchTimeMs ?? 0;

				// If this is an incremental sync (we have a lastSyncAt), add new views to total
				// If this is the first sync, the newViews becomes the baseline
				const cumulativeViews = lastSyncAt ? storedViewCount + newViews : newViews;
				const cumulativeWatchTime = lastSyncAt ? storedWatchTime + newWatchTime : newWatchTime;

				// Update the database with new cumulative totals
				await db
					.update(video)
					.set({
						viewCount: cumulativeViews,
						totalWatchTimeMs: cumulativeWatchTime,
						viewCountSyncedAt: new Date(now),
						updatedAt: new Date(now),
					})
					.where(eq(video.id, videoRecord.id));

				return {
					muxAssetId,
					views: cumulativeViews,
					totalWatchTime: cumulativeWatchTime,
					totalPlayingTime: response.data?.total_playing_time ?? null,
					lastSyncAt: lastSyncAt ? new Date(lastSyncAt).toISOString() : null,
					newViewsSinceLastSync: lastSyncAt ? newViews : null,
					source: "database-synced" as const,
				};
			} catch (error) {
				// If Mux API fails, return stored values from database
				console.warn("Failed to fetch view count from Mux Data API:", error);

				const db = getVideosDb(env);
				const [videoRecord] = await db
					.select({
						viewCount: video.viewCount,
						totalWatchTimeMs: video.totalWatchTimeMs,
						viewCountSyncedAt: video.viewCountSyncedAt,
					})
					.from(video)
					.where(and(eq(video.muxAssetId, muxAssetId), eq(video.libraryId, libraryId)))
					.limit(1);

				return {
					muxAssetId,
					views: videoRecord?.viewCount ?? 0,
					totalWatchTime: videoRecord?.totalWatchTimeMs ?? null,
					totalPlayingTime: null,
					lastSyncAt: videoRecord?.viewCountSyncedAt?.toISOString() ?? null,
					source: "database-cached" as const,
				};
			}
		}),

	// ============================================================================
	// Chapter Management
	// ============================================================================

	/**
	 * Get chapters for a video by internal video ID
	 */
	getChapters: protectedProcedure
		.input(
			z.object({
				videoId: z.string(), // Internal database video ID
				libraryId: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { env } = ctx;
			const { videoId, libraryId } = input;

			const db = getVideosDb(env);

			// Verify video exists with the given internal ID
			const whereClause = libraryId
				? and(eq(video.id, videoId), eq(video.libraryId, libraryId))
				: eq(video.id, videoId);

			const [videoRecord] = await db
				.select({ id: video.id })
				.from(video)
				.where(whereClause)
				.limit(1);

			if (!videoRecord) {
				return [];
			}

			// Get chapters for this video
			const chapters = await db
				.select()
				.from(videoChapter)
				.where(eq(videoChapter.videoId, videoRecord.id))
				.orderBy(asc(videoChapter.sortOrder), asc(videoChapter.startTime));

			return chapters.map((chapter) => ({
				id: chapter.id,
				title: chapter.title,
				startTime: chapter.startTime,
				endTime: chapter.endTime,
				sortOrder: chapter.sortOrder,
				thumbnailTime: chapter.thumbnailTime,
			}));
		}),

	/**
	 * Save chapters for a video by internal video ID (replace all existing chapters)
	 */
	saveChapters: protectedProcedure
		.input(
			z.object({
				videoId: z.string(), // Internal database video ID
				libraryId: z.string().optional(),
				chapters: z.array(
					z.object({
						id: z.string().optional(),
						title: z.string().min(1),
						startTime: z.number().min(0),
						endTime: z.number().min(0).optional().nullable(),
						sortOrder: z.number().optional(),
						thumbnailTime: z.number().optional().nullable(),
					}),
				),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const { videoId, libraryId, chapters } = input;

			const db = getVideosDb(env);

			// Verify video exists with the given internal ID
			const whereClause = libraryId
				? and(eq(video.id, videoId), eq(video.libraryId, libraryId))
				: eq(video.id, videoId);

			const [videoRecord] = await db
				.select({ id: video.id })
				.from(video)
				.where(whereClause)
				.limit(1);

			if (!videoRecord) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Video not found in database. Please sync the video first.",
				});
			}

			// Delete existing chapters for this video
			await db
				.delete(videoChapter)
				.where(eq(videoChapter.videoId, videoRecord.id));

			// Insert new chapters
			if (chapters.length > 0) {
				const chaptersToInsert = chapters.map((chapter, index) => ({
					id: chapter.id || generateChapterId(),
					videoId: videoRecord.id,
					title: chapter.title,
					startTime: chapter.startTime,
					endTime: chapter.endTime ?? null,
					sortOrder: chapter.sortOrder ?? index,
					thumbnailTime: chapter.thumbnailTime ?? null,
				}));

				await db.insert(videoChapter).values(chaptersToInsert);
			}

			// Return the saved chapters
			const savedChapters = await db
				.select()
				.from(videoChapter)
				.where(eq(videoChapter.videoId, videoRecord.id))
				.orderBy(asc(videoChapter.sortOrder), asc(videoChapter.startTime));

			return savedChapters.map((chapter) => ({
				id: chapter.id,
				title: chapter.title,
				startTime: chapter.startTime,
				endTime: chapter.endTime,
				sortOrder: chapter.sortOrder,
				thumbnailTime: chapter.thumbnailTime,
			}));
		}),

	/**
	 * Delete a single chapter
	 */
	deleteChapter: protectedProcedure
		.input(
			z.object({
				chapterId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const { chapterId } = input;

			const db = getVideosDb(env);

			await db.delete(videoChapter).where(eq(videoChapter.id, chapterId));

			return { success: true };
		}),

	/**
	 * List all videos from the internal database (not directly from Mux)
	 * This returns videos with internal IDs for navigation
	 */
	listVideosFromDatabase: protectedProcedure
		.input(
			z.object({
				libraryId: z.string(),
				limit: z.number().min(1).max(100).default(50),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { libraryId, limit, offset } = input;

			try {
				// Verify library exists and get credentials
				const { library } = await getMuxClient(env, libraryId);

				// Fetch videos from database
				const videos = await db
					.select({
						id: video.id,
						libraryId: video.libraryId,
						muxAssetId: video.muxAssetId,
						muxPlaybackId: video.muxPlaybackId,
						status: video.status,
						title: video.title,
						description: video.description,
						duration: video.duration,
						aspectRatio: video.aspectRatio,
						maxWidth: video.maxWidth,
						maxHeight: video.maxHeight,
						resolutionTier: video.resolutionTier,
						videoQuality: video.videoQuality,
						playbackPolicy: video.playbackPolicy,
						isPublished: video.isPublished,
						publishedAt: video.publishedAt,
						viewCount: video.viewCount,
						createdAt: video.createdAt,
						updatedAt: video.updatedAt,
					})
					.from(video)
					.where(
						and(
							eq(video.libraryId, library.id),
							eq(video.isDeleted, false),
						),
					)
					.orderBy(asc(video.createdAt))
					.limit(limit)
					.offset(offset);

				// Map to a consistent format
				return videos.map((v) => ({
					id: v.id, // Internal database ID
					muxAssetId: v.muxAssetId,
					playbackId: v.muxPlaybackId,
					status: v.status as MuxAssetState,
					title: v.title,
					description: v.description,
					duration: v.duration ?? 0,
					aspectRatio: v.aspectRatio,
					maxWidth: v.maxWidth,
					maxHeight: v.maxHeight,
					resolutionTier: v.resolutionTier,
					videoQuality: v.videoQuality,
					policy: v.playbackPolicy as "public" | "signed" | undefined,
					isPublished: v.isPublished,
					publishedAt: v.publishedAt?.toISOString(),
					views: v.viewCount ?? 0,
					createdAt: v.createdAt.toISOString(),
					updatedAt: v.updatedAt.toISOString(),
				}));
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error listing videos from database:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to list videos from database",
				});
			}
		}),

	/**
	 * Get a single video by internal database ID
	 * This combines database metadata with Mux asset data
	 */
	getVideoById: protectedProcedure
		.input(z.object({ videoId: z.string(), libraryId: z.string() }))
		.query(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { videoId, libraryId } = input;

			try {
				// Fetch video from database by internal ID
				const [videoRecord] = await db
					.select()
					.from(video)
					.where(
						and(
							eq(video.id, videoId),
							eq(video.libraryId, libraryId),
							eq(video.isDeleted, false),
						),
					)
					.limit(1);

				if (!videoRecord) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: `Video ${videoId} not found`,
					});
				}

				// Get Mux client and fetch asset details from Mux
				const { mux, library } = await getMuxClient(env, libraryId);
				
				let muxAsset: MuxAsset | null = null;
				try {
					const asset = await mux.video.assets.retrieve(videoRecord.muxAssetId);
					muxAsset = mapMuxAssetToVideo(asset);
				} catch (muxError) {
					console.warn("Could not fetch Mux asset details:", muxError);
					// Continue without Mux data - use database data only
				}

				// Combine database and Mux data
				return {
					// Internal database fields
					id: videoRecord.id,
					libraryId: videoRecord.libraryId,
					muxAssetId: videoRecord.muxAssetId,
					muxPlaybackId: videoRecord.muxPlaybackId,
					muxEnvironmentId: library.muxEnvironmentId,
					// Status from database (may be synced from Mux)
					status: videoRecord.status,
					// Error information
					errorCategory: videoRecord.errorCategory,
					errorMessages: videoRecord.errorMessages,
					// Metadata
					title: videoRecord.title,
					description: videoRecord.description,
					// Video properties (prefer Mux data if available, fallback to database)
					duration: muxAsset?.duration ?? videoRecord.duration ?? 0,
					aspectRatio: muxAsset?.aspectRatio ?? videoRecord.aspectRatio,
					maxWidth: muxAsset?.maxWidth ?? videoRecord.maxWidth,
					maxHeight: muxAsset?.maxHeight ?? videoRecord.maxHeight,
					maxStoredFrameRate: muxAsset?.maxStoredFrameRate ?? videoRecord.maxFrameRate,
					resolutionTier: muxAsset?.resolutionTier ?? videoRecord.resolutionTier,
					videoQuality: muxAsset?.videoQuality ?? videoRecord.videoQuality,
					// Playback
					playbackId: videoRecord.muxPlaybackId ?? muxAsset?.playbackId,
					policy: videoRecord.playbackPolicy ?? muxAsset?.policy ?? "public",
					// Captions from Mux
					captions: muxAsset?.captions,
					// Publishing status
					isPublished: videoRecord.isPublished,
					publishedAt: videoRecord.publishedAt?.toISOString(),
					// Analytics
					views: videoRecord.viewCount ?? 0,
					viewCountSyncedAt: videoRecord.viewCountSyncedAt?.toISOString(),
					tags: parseTagsColumn(videoRecord.tags),
					// Timestamps
					createdAt: videoRecord.createdAt.toISOString(),
					updatedAt: videoRecord.updatedAt.toISOString(),
					// Library info
					libraryName: library.name,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error fetching video by ID:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch video",
				});
			}
		}),

	/**
	 * Update video metadata by internal database ID
	 */
	updateVideoById: protectedProcedure
		.input(
			z.object({
				videoId: z.string(),
				libraryId: z.string(),
				title: z.string().optional(),
				description: z.string().optional(),
				isPublished: z.boolean().optional(),
				publishedAt: z.string().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { videoId, libraryId, ...updateFields } = input;

			try {
				// Verify video exists
				const [existingVideo] = await db
					.select({ id: video.id, muxAssetId: video.muxAssetId })
					.from(video)
					.where(
						and(
							eq(video.id, videoId),
							eq(video.libraryId, libraryId),
						),
					)
					.limit(1);

				if (!existingVideo) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Video not found",
					});
				}

				// Build update object
				const updateData: Partial<typeof video.$inferInsert> = {};
				if (updateFields.title !== undefined) {
					updateData.title = updateFields.title;
				}
				if (updateFields.description !== undefined) {
					updateData.description = updateFields.description;
				}
				if (updateFields.isPublished !== undefined) {
					updateData.isPublished = updateFields.isPublished;
				}
				if (updateFields.publishedAt !== undefined) {
					updateData.publishedAt = updateFields.publishedAt ? new Date(updateFields.publishedAt) : null;
				}

				if (Object.keys(updateData).length === 0) {
					return { success: true };
				}

				// Update the database record
				await db
					.update(video)
					.set(updateData)
					.where(eq(video.id, videoId));

				// Also update Mux asset title if title changed
				if (updateFields.title !== undefined) {
					try {
						const { mux } = await getMuxClient(env, libraryId);
						await mux.video.assets.update(existingVideo.muxAssetId, {
							meta: { title: updateFields.title },
						});
					} catch (muxError) {
						console.warn("Could not update Mux asset title:", muxError);
						// Don't fail - database update succeeded
					}
				}

				return { success: true };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error updating video:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update video",
				});
			}
		}),

	/**
	 * Update tags on a video
	 */
	updateVideoTags: protectedProcedure
		.input(
			z.object({
				videoId: z.string(),
				libraryId: z.string(),
				tags: z
					.array(
						z
							.string()
							.trim()
							.min(1, "Tag cannot be empty")
							.max(32, "Tags must be 32 characters or less")
							.regex(/^[a-zA-Z0-9:@._\- ]+$/, "Tags may only contain letters, numbers, spaces, and : @ . _ -"),
						)
					.max(12, "You can add up to 12 tags")
					.default([]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { videoId, libraryId, tags } = input;

			const [existingVideo] = await db
				.select({ id: video.id })
				.from(video)
				.where(
					and(eq(video.id, videoId), eq(video.libraryId, libraryId)),
				)
				.limit(1);

			if (!existingVideo) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Video not found",
				});
			}

			const uniqueTags = tags.filter((tag, index) => tags.indexOf(tag) === index);
			const serializedTags = uniqueTags.length > 0 ? JSON.stringify(uniqueTags) : null;

			await db
				.update(video)
				.set({ tags: serializedTags })
				.where(eq(video.id, videoId));

			return { success: true, tags: uniqueTags };
		}),

	/**
	 * Update the playback policy for a video
	 * Creates a new playback ID with the desired policy and deletes the old one
	 * to ensure only one playback ID exists per video
	 */
	updatePlaybackPolicy: protectedProcedure
		.input(
			z.object({
				videoId: z.string(),
				libraryId: z.string(),
				playbackPolicy: z.enum(["public", "signed"]),
			}),
		)
		.mutation(
			async ({
				ctx,
				input,
			}): Promise<{ success: boolean; playbackId: string }> => {
				const { env } = ctx;
				const db = getVideosDb(env);
				const { videoId, libraryId, playbackPolicy } = input;

				try {
					// Get the video record
					const [videoRecord] = await db
						.select({
							id: video.id,
							muxAssetId: video.muxAssetId,
							muxPlaybackId: video.muxPlaybackId,
							playbackPolicy: video.playbackPolicy,
						})
						.from(video)
						.where(
							and(eq(video.id, videoId), eq(video.libraryId, libraryId)),
						)
						.limit(1);

					if (!videoRecord) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: "Video not found",
						});
					}

					// Check if policy is already the same
					if (videoRecord.playbackPolicy === playbackPolicy) {
						return {
							success: true,
							playbackId: videoRecord.muxPlaybackId || "",
						};
					}

					const { mux } = await getMuxClient(env, libraryId);
					const oldPlaybackId = videoRecord.muxPlaybackId;

					// Create a new playback ID with the desired policy
					const newPlaybackId = await mux.video.assets.createPlaybackId(
						videoRecord.muxAssetId,
						{ policy: playbackPolicy },
					);

					// Delete the old playback ID to ensure only one exists
					if (oldPlaybackId) {
						try {
							await mux.video.assets.deletePlaybackId(
								videoRecord.muxAssetId,
								oldPlaybackId,
							);
						} catch (deleteError) {
							console.warn(
								"Could not delete old playback ID:",
								deleteError,
							);
							// Continue - the new playback ID was created successfully
						}
					}

					// Update the database with the new playback ID and policy
					await db
						.update(video)
						.set({
							muxPlaybackId: newPlaybackId.id,
							playbackPolicy: playbackPolicy,
						})
						.where(eq(video.id, videoId));

					return {
						success: true,
						playbackId: newPlaybackId.id,
					};
				} catch (error) {
					if (error instanceof TRPCError) throw error;
					console.error("Error updating playback policy:", error);
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to update playback policy",
					});
				}
			},
		),

	/**
	 * Delete a video by internal database ID
	 */
	deleteVideoById: protectedProcedure
		.input(z.object({ videoId: z.string(), libraryId: z.string() }))
		.mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { videoId, libraryId } = input;

			try {
				// Find the video to get the Mux asset ID
				const [videoRecord] = await db
					.select({ id: video.id, muxAssetId: video.muxAssetId })
					.from(video)
					.where(
						and(
							eq(video.id, videoId),
							eq(video.libraryId, libraryId),
						),
					)
					.limit(1);

				if (!videoRecord) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Video not found",
					});
				}

				// Delete from Mux
				try {
					const { mux } = await getMuxClient(env, libraryId);
					await mux.video.assets.delete(videoRecord.muxAssetId);
				} catch (muxError) {
					console.warn("Could not delete Mux asset:", muxError);
					// Continue with database deletion even if Mux fails
				}

				// Soft delete in database
				await db
					.update(video)
					.set({ isDeleted: true, deletedAt: new Date() })
					.where(eq(video.id, videoId));

				return { success: true };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error deleting video:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete video",
				});
			}
		}),

	// ============================================================================
	// Playlist Procedures
	// ============================================================================

	/**
	 * Create a new playlist
	 */
	createPlaylist: protectedProcedure
		.input(
			z.object({
				libraryId: z.string(),
				name: z.string().min(1).max(100),
				slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
					message: "Slug must be lowercase with hyphens only (e.g., 'my-playlist')",
				}),
				description: z.string().max(1000).optional(),
				category: z.enum(["featured", "interviews", "series", "short-form", "other"]).optional(),
				thumbnailVideoId: z.string().optional(),
				thumbnailTime: z.number().min(0).optional(),
				tags: z.array(z.string()).optional(),
				customMetadata: z.record(z.string(), z.unknown()).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const {
				libraryId,
				name,
				slug,
				description,
				category,
				thumbnailVideoId,
				thumbnailTime,
				tags,
				customMetadata,
			} = input;

			try {
				// Verify library exists
				await getMuxLibrary(env, libraryId);

				// Check if slug already exists for this library
				const existingPlaylist = await db
					.select({ id: playlist.id })
					.from(playlist)
					.where(
						and(
							eq(playlist.libraryId, libraryId),
							eq(playlist.slug, slug),
							eq(playlist.isDeleted, false),
						),
					)
					.limit(1);

				if (existingPlaylist.length > 0) {
					throw new TRPCError({
						code: "CONFLICT",
						message: `A playlist with slug "${slug}" already exists in this library`,
					});
				}

				// Verify thumbnail video exists if provided
				if (thumbnailVideoId) {
					const thumbnailVideo = await db
						.select({ id: video.id })
						.from(video)
						.where(
							and(
								eq(video.id, thumbnailVideoId),
								eq(video.libraryId, libraryId),
								eq(video.isDeleted, false),
							),
						)
						.limit(1);

					if (thumbnailVideo.length === 0) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: "Thumbnail video not found",
						});
					}
				}

				// Get max sort order for new playlist
				const maxOrderResult = await db
					.select({ maxOrder: sql<number>`MAX(${playlist.sortOrder})` })
					.from(playlist)
					.where(and(eq(playlist.libraryId, libraryId), eq(playlist.isDeleted, false)));

				const nextSortOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

				const playlistId = generatePlaylistId();
				const now = new Date();

				await db.insert(playlist).values({
					id: playlistId,
					libraryId,
					name,
					slug,
					description: description ?? null,
					category,
					thumbnailVideoId: thumbnailVideoId ?? null,
					thumbnailTime: thumbnailTime ?? null,
					sortOrder: nextSortOrder,
					tags: tags ? JSON.stringify(tags) : null,
					customMetadata: customMetadata ? JSON.stringify(customMetadata) : null,
					isPublished: false,
					isDeleted: false,
					createdAt: now,
					updatedAt: now,
				});

				return {
					id: playlistId,
					name,
					slug,
					category,
					sortOrder: nextSortOrder,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error creating playlist:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create playlist",
				});
			}
		}),

	/**
	 * List all playlists for a library
	 */
	listPlaylists: protectedProcedure
		.input(
			z.object({
				libraryId: z.string(),
				includeUnpublished: z.boolean().default(true),
				category: z.enum(["featured", "interviews", "series", "short-form", "other"]).optional(),
				limit: z.number().min(1).max(100).default(50),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { libraryId, includeUnpublished, category, limit, offset } = input;

			try {
				const conditions = [
					eq(playlist.libraryId, libraryId),
					eq(playlist.isDeleted, false),
				];

				if (!includeUnpublished) {
					conditions.push(eq(playlist.isPublished, true));
				}

				if (category) {
					conditions.push(eq(playlist.category, category));
				}

				const playlists = await db
					.select({
						id: playlist.id,
						name: playlist.name,
						slug: playlist.slug,
						description: playlist.description,
						category: playlist.category,
						thumbnailVideoId: playlist.thumbnailVideoId,
						thumbnailTime: playlist.thumbnailTime,
						isPublished: playlist.isPublished,
						publishedAt: playlist.publishedAt,
						sortOrder: playlist.sortOrder,
						tags: playlist.tags,
						customMetadata: playlist.customMetadata,
						createdAt: playlist.createdAt,
						updatedAt: playlist.updatedAt,
					})
					.from(playlist)
					.where(and(...conditions))
					.orderBy(asc(playlist.sortOrder), desc(playlist.createdAt))
					.limit(limit)
					.offset(offset);

				// Get video count for each playlist
				const playlistIds = playlists.map((p) => p.id);
				const videoCounts = playlistIds.length > 0
					? await db
						.select({
							playlistId: playlistItem.playlistId,
							count: sql<number>`COUNT(*)`,
						})
						.from(playlistItem)
						.where(inArray(playlistItem.playlistId, playlistIds))
						.groupBy(playlistItem.playlistId)
					: [];

				const countMap = new Map(videoCounts.map((vc) => [vc.playlistId, vc.count]));

				// Get thumbnail info for playlists with thumbnailVideoId
				const thumbnailVideoIds = playlists
					.map((p) => p.thumbnailVideoId)
					.filter((id): id is string => id !== null);

				const thumbnailVideos = thumbnailVideoIds.length > 0
					? await db
						.select({
							id: video.id,
							muxPlaybackId: video.muxPlaybackId,
							playbackPolicy: video.playbackPolicy,
						})
						.from(video)
						.where(inArray(video.id, thumbnailVideoIds))
					: [];

				const thumbnailMap = new Map(thumbnailVideos.map((v) => [v.id, { playbackId: v.muxPlaybackId, policy: v.playbackPolicy }]));

				// Get first video playback ID and policy for playlists without explicit thumbnail
				const playlistsNeedingFirstVideo = playlists.filter((p) => !p.thumbnailVideoId);
				const firstVideoMap = new Map<string, { playbackId: string | null; policy: string | null }>();

				if (playlistsNeedingFirstVideo.length > 0) {
					// For each playlist without a thumbnail, get the first video's playback ID and policy
					for (const p of playlistsNeedingFirstVideo) {
						const firstVideo = await db
							.select({
								muxPlaybackId: video.muxPlaybackId,
								playbackPolicy: video.playbackPolicy,
							})
							.from(playlistItem)
							.innerJoin(video, eq(playlistItem.videoId, video.id))
							.where(eq(playlistItem.playlistId, p.id))
							.orderBy(asc(playlistItem.sortOrder))
							.limit(1);

						firstVideoMap.set(p.id, {
							playbackId: firstVideo[0]?.muxPlaybackId ?? null,
							policy: firstVideo[0]?.playbackPolicy ?? null,
						});
					}
				}

				return playlists.map((p) => {
					const thumbnailInfo = p.thumbnailVideoId
						? thumbnailMap.get(p.thumbnailVideoId)
						: firstVideoMap.get(p.id);

					return {
						...p,
						tags: parseTagsColumn(p.tags),
						customMetadata: p.customMetadata ? JSON.parse(p.customMetadata) : null,
						videoCount: countMap.get(p.id) ?? 0,
						thumbnailPlaybackId: thumbnailInfo?.playbackId ?? null,
						thumbnailPolicy: (thumbnailInfo?.policy as "public" | "signed" | null) ?? null,
					};
				});
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error listing playlists:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to list playlists",
				});
			}
		}),

	/**
	 * Get a single playlist by ID or slug with its videos
	 */
	getPlaylist: protectedProcedure
		.input(
			z.object({
				libraryId: z.string(),
				playlistId: z.string().optional(),
				slug: z.string().optional(),
				includeVideos: z.boolean().default(true),
			}).refine((data) => data.playlistId || data.slug, {
				message: "Either playlistId or slug must be provided",
			}),
		)
		.query(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { libraryId, playlistId, slug, includeVideos } = input;

			try {
				const conditions = [
					eq(playlist.libraryId, libraryId),
					eq(playlist.isDeleted, false),
				];

				if (playlistId) {
					conditions.push(eq(playlist.id, playlistId));
				} else if (slug) {
					conditions.push(eq(playlist.slug, slug));
				}

				const [playlistRecord] = await db
					.select()
					.from(playlist)
					.where(and(...conditions))
					.limit(1);

				if (!playlistRecord) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Playlist not found",
					});
				}

				// Get thumbnail video info
				let thumbnailPlaybackId: string | null = null;
				if (playlistRecord.thumbnailVideoId) {
					const [thumbnailVideo] = await db
						.select({ muxPlaybackId: video.muxPlaybackId })
						.from(video)
						.where(eq(video.id, playlistRecord.thumbnailVideoId))
						.limit(1);
					thumbnailPlaybackId = thumbnailVideo?.muxPlaybackId ?? null;
				}

				let videos: Array<{
					id: string;
					title: string;
					description: string | null;
					muxPlaybackId: string | null;
					playbackPolicy: "public" | "signed" | null;
					duration: number | null;
					status: string;
					isPublished: boolean;
					sortOrder: number;
					customTitle: string | null;
					customDescription: string | null;
					addedAt: Date;
				}> = [];

				if (includeVideos) {
					const playlistVideos = await db
						.select({
							// Video fields
							id: video.id,
							title: video.title,
							description: video.description,
							muxPlaybackId: video.muxPlaybackId,
							playbackPolicy: video.playbackPolicy,
							duration: video.duration,
							status: video.status,
							isPublished: video.isPublished,
							aspectRatio: video.aspectRatio,
							// Playlist item fields
							sortOrder: playlistItem.sortOrder,
							customTitle: playlistItem.customTitle,
							customDescription: playlistItem.customDescription,
							addedAt: playlistItem.addedAt,
						})
						.from(playlistItem)
						.innerJoin(video, eq(playlistItem.videoId, video.id))
						.where(
							and(
								eq(playlistItem.playlistId, playlistRecord.id),
								eq(video.isDeleted, false),
							),
						)
						.orderBy(asc(playlistItem.sortOrder));

					videos = playlistVideos;
				}

				return {
					...playlistRecord,
					tags: parseTagsColumn(playlistRecord.tags),
					customMetadata: playlistRecord.customMetadata
						? JSON.parse(playlistRecord.customMetadata)
						: null,
					thumbnailPlaybackId,
					videos,
					videoCount: videos.length,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error getting playlist:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get playlist",
				});
			}
		}),

	/**
	 * Update a playlist
	 */
	updatePlaylist: protectedProcedure
		.input(
			z.object({
				playlistId: z.string(),
				libraryId: z.string(),
				name: z.string().min(1).max(100).optional(),
				slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
				description: z.string().max(1000).nullable().optional(),
				category: z.enum(["featured", "interviews", "series", "short-form", "other"]).optional(),
				thumbnailVideoId: z.string().nullable().optional(),
				thumbnailTime: z.number().min(0).nullable().optional(),
				tags: z.array(z.string()).nullable().optional(),
				customMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
				sortOrder: z.number().min(0).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { playlistId, libraryId, ...updates } = input;

			try {
				// Verify playlist exists
				const [existingPlaylist] = await db
					.select({ id: playlist.id, slug: playlist.slug })
					.from(playlist)
					.where(
						and(
							eq(playlist.id, playlistId),
							eq(playlist.libraryId, libraryId),
							eq(playlist.isDeleted, false),
						),
					)
					.limit(1);

				if (!existingPlaylist) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Playlist not found",
					});
				}

				// Check slug uniqueness if changing
				if (updates.slug && updates.slug !== existingPlaylist.slug) {
					const slugConflict = await db
						.select({ id: playlist.id })
						.from(playlist)
						.where(
							and(
								eq(playlist.libraryId, libraryId),
								eq(playlist.slug, updates.slug),
								eq(playlist.isDeleted, false),
							),
						)
						.limit(1);

					if (slugConflict.length > 0) {
						throw new TRPCError({
							code: "CONFLICT",
							message: `A playlist with slug "${updates.slug}" already exists`,
						});
					}
				}

				// Verify thumbnail video if provided
				if (updates.thumbnailVideoId) {
					const [thumbVideo] = await db
						.select({ id: video.id })
						.from(video)
						.where(
							and(
								eq(video.id, updates.thumbnailVideoId),
								eq(video.libraryId, libraryId),
								eq(video.isDeleted, false),
							),
						)
						.limit(1);

					if (!thumbVideo) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: "Thumbnail video not found",
						});
					}
				}

				// Build update object
				const updateData: Record<string, unknown> = {
					updatedAt: new Date(),
				};

				if (updates.name !== undefined) updateData.name = updates.name;
				if (updates.slug !== undefined) updateData.slug = updates.slug;
				if (updates.description !== undefined) updateData.description = updates.description;
				if (updates.category !== undefined) updateData.category = updates.category;
				if (updates.thumbnailVideoId !== undefined) updateData.thumbnailVideoId = updates.thumbnailVideoId;
				if (updates.thumbnailTime !== undefined) updateData.thumbnailTime = updates.thumbnailTime;
				if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;
				if (updates.tags !== undefined) {
					updateData.tags = updates.tags ? JSON.stringify(updates.tags) : null;
				}
				if (updates.customMetadata !== undefined) {
					updateData.customMetadata = updates.customMetadata ? JSON.stringify(updates.customMetadata) : null;
				}

				await db
					.update(playlist)
					.set(updateData)
					.where(eq(playlist.id, playlistId));

				return { success: true, playlistId };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error updating playlist:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update playlist",
				});
			}
		}),

	/**
	 * Publish or unpublish a playlist
	 */
	setPlaylistPublishStatus: protectedProcedure
		.input(
			z.object({
				playlistId: z.string(),
				libraryId: z.string(),
				isPublished: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { playlistId, libraryId, isPublished } = input;

			try {
				const [existingPlaylist] = await db
					.select({ id: playlist.id })
					.from(playlist)
					.where(
						and(
							eq(playlist.id, playlistId),
							eq(playlist.libraryId, libraryId),
							eq(playlist.isDeleted, false),
						),
					)
					.limit(1);

				if (!existingPlaylist) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Playlist not found",
					});
				}

				await db
					.update(playlist)
					.set({
						isPublished,
						publishedAt: isPublished ? new Date() : null,
						updatedAt: new Date(),
					})
					.where(eq(playlist.id, playlistId));

				return { success: true, isPublished };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error updating playlist publish status:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update playlist publish status",
				});
			}
		}),

	/**
	 * Delete a playlist (soft delete)
	 */
	deletePlaylist: protectedProcedure
		.input(
			z.object({
				playlistId: z.string(),
				libraryId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { playlistId, libraryId } = input;

			try {
				const [existingPlaylist] = await db
					.select({ id: playlist.id })
					.from(playlist)
					.where(
						and(
							eq(playlist.id, playlistId),
							eq(playlist.libraryId, libraryId),
							eq(playlist.isDeleted, false),
						),
					)
					.limit(1);

				if (!existingPlaylist) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Playlist not found",
					});
				}

				await db
					.update(playlist)
					.set({
						isDeleted: true,
						deletedAt: new Date(),
						updatedAt: new Date(),
					})
					.where(eq(playlist.id, playlistId));

				return { success: true };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error deleting playlist:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete playlist",
				});
			}
		}),

	/**
	 * Add a video to a playlist
	 */
	addVideoToPlaylist: protectedProcedure
		.input(
			z.object({
				playlistId: z.string(),
				libraryId: z.string(),
				videoId: z.string(),
				customTitle: z.string().max(200).optional(),
				customDescription: z.string().max(1000).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { playlistId, libraryId, videoId, customTitle, customDescription } = input;

			try {
				// Verify playlist exists
				const [existingPlaylist] = await db
					.select({ id: playlist.id })
					.from(playlist)
					.where(
						and(
							eq(playlist.id, playlistId),
							eq(playlist.libraryId, libraryId),
							eq(playlist.isDeleted, false),
						),
					)
					.limit(1);

				if (!existingPlaylist) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Playlist not found",
					});
				}

				// Verify video exists
				const [existingVideo] = await db
					.select({ id: video.id })
					.from(video)
					.where(
						and(
							eq(video.id, videoId),
							eq(video.libraryId, libraryId),
							eq(video.isDeleted, false),
						),
					)
					.limit(1);

				if (!existingVideo) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Video not found",
					});
				}

				// Check if video is already in playlist
				const [existingItem] = await db
					.select({ id: playlistItem.id })
					.from(playlistItem)
					.where(
						and(
							eq(playlistItem.playlistId, playlistId),
							eq(playlistItem.videoId, videoId),
						),
					)
					.limit(1);

				if (existingItem) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "Video is already in this playlist",
					});
				}

				// Check playlist video count limit (max 50 videos)
				const MAX_PLAYLIST_VIDEOS = 50;
				const [countResult] = await db
					.select({ count: sql<number>`COUNT(*)` })
					.from(playlistItem)
					.where(eq(playlistItem.playlistId, playlistId));

				if ((countResult?.count ?? 0) >= MAX_PLAYLIST_VIDEOS) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Playlist cannot have more than ${MAX_PLAYLIST_VIDEOS} videos`,
					});
				}

				// Get max sort order
				const maxOrderResult = await db
					.select({ maxOrder: sql<number>`MAX(${playlistItem.sortOrder})` })
					.from(playlistItem)
					.where(eq(playlistItem.playlistId, playlistId));

				const nextSortOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

				const itemId = generatePlaylistItemId();
				const now = new Date();

				await db.insert(playlistItem).values({
					id: itemId,
					playlistId,
					videoId,
					sortOrder: nextSortOrder,
					customTitle: customTitle ?? null,
					customDescription: customDescription ?? null,
					addedAt: now,
				});

				// Update playlist's updatedAt
				await db
					.update(playlist)
					.set({ updatedAt: now })
					.where(eq(playlist.id, playlistId));

				return {
					id: itemId,
					playlistId,
					videoId,
					sortOrder: nextSortOrder,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error adding video to playlist:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to add video to playlist",
				});
			}
		}),

	/**
	 * Remove a video from a playlist
	 */
	removeVideoFromPlaylist: protectedProcedure
		.input(
			z.object({
				playlistId: z.string(),
				libraryId: z.string(),
				videoId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { playlistId, libraryId, videoId } = input;

			try {
				// Verify playlist exists and belongs to library
				const [existingPlaylist] = await db
					.select({ id: playlist.id })
					.from(playlist)
					.where(
						and(
							eq(playlist.id, playlistId),
							eq(playlist.libraryId, libraryId),
							eq(playlist.isDeleted, false),
						),
					)
					.limit(1);

				if (!existingPlaylist) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Playlist not found",
					});
				}

				// Delete the playlist item
				await db
					.delete(playlistItem)
					.where(
						and(
							eq(playlistItem.playlistId, playlistId),
							eq(playlistItem.videoId, videoId),
						),
					);

				// Update playlist's updatedAt
				await db
					.update(playlist)
					.set({ updatedAt: new Date() })
					.where(eq(playlist.id, playlistId));

				return { success: true };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error removing video from playlist:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to remove video from playlist",
				});
			}
		}),

	/**
	 * Reorder videos in a playlist
	 */
	reorderPlaylistVideos: protectedProcedure
		.input(
			z.object({
				playlistId: z.string(),
				libraryId: z.string(),
				videoIds: z.array(z.string()).min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { playlistId, libraryId, videoIds } = input;

			try {
				// Verify playlist exists
				const [existingPlaylist] = await db
					.select({ id: playlist.id })
					.from(playlist)
					.where(
						and(
							eq(playlist.id, playlistId),
							eq(playlist.libraryId, libraryId),
							eq(playlist.isDeleted, false),
						),
					)
					.limit(1);

				if (!existingPlaylist) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Playlist not found",
					});
				}

				// Update sort order for each video
				const now = new Date();
				for (let i = 0; i < videoIds.length; i++) {
					await db
						.update(playlistItem)
						.set({ sortOrder: i })
						.where(
							and(
								eq(playlistItem.playlistId, playlistId),
								eq(playlistItem.videoId, videoIds[i]),
							),
						);
				}

				// Update playlist's updatedAt
				await db
					.update(playlist)
					.set({ updatedAt: now })
					.where(eq(playlist.id, playlistId));

				return { success: true };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error reordering playlist videos:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to reorder playlist videos",
				});
			}
		}),

	/**
	 * Update a playlist item (custom title/description)
	 */
	updatePlaylistItem: protectedProcedure
		.input(
			z.object({
				playlistId: z.string(),
				libraryId: z.string(),
				videoId: z.string(),
				customTitle: z.string().max(200).nullable().optional(),
				customDescription: z.string().max(1000).nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { playlistId, libraryId, videoId, customTitle, customDescription } = input;

			try {
				// Verify playlist exists
				const [existingPlaylist] = await db
					.select({ id: playlist.id })
					.from(playlist)
					.where(
						and(
							eq(playlist.id, playlistId),
							eq(playlist.libraryId, libraryId),
							eq(playlist.isDeleted, false),
						),
					)
					.limit(1);

				if (!existingPlaylist) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Playlist not found",
					});
				}

				// Find the playlist item
				const [existingItem] = await db
					.select({ id: playlistItem.id })
					.from(playlistItem)
					.where(
						and(
							eq(playlistItem.playlistId, playlistId),
							eq(playlistItem.videoId, videoId),
						),
					)
					.limit(1);

				if (!existingItem) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Video not found in playlist",
					});
				}

				// Build update object
				const updateData: Record<string, unknown> = {};
				if (customTitle !== undefined) updateData.customTitle = customTitle;
				if (customDescription !== undefined) updateData.customDescription = customDescription;

				if (Object.keys(updateData).length > 0) {
					await db
						.update(playlistItem)
						.set(updateData)
						.where(eq(playlistItem.id, existingItem.id));

					// Update playlist's updatedAt
					await db
						.update(playlist)
						.set({ updatedAt: new Date() })
						.where(eq(playlist.id, playlistId));
				}

				return { success: true };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error updating playlist item:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update playlist item",
				});
			}
		}),

	/**
	 * Reorder playlists within a library
	 */
	reorderPlaylists: protectedProcedure
		.input(
			z.object({
				libraryId: z.string(),
				playlistIds: z.array(z.string()).min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { libraryId, playlistIds } = input;

			try {
				// Verify library exists
				await getMuxLibrary(env, libraryId);

				// Update sort order for each playlist
				const now = new Date();
				for (let i = 0; i < playlistIds.length; i++) {
					await db
						.update(playlist)
						.set({ sortOrder: i, updatedAt: now })
						.where(
							and(
								eq(playlist.id, playlistIds[i]),
								eq(playlist.libraryId, libraryId),
							),
						);
				}

				return { success: true };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error reordering playlists:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to reorder playlists",
				});
			}
		}),
});
