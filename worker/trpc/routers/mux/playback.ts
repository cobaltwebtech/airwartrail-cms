import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { t, protectedProcedure, createPermissionMiddleware } from "../../trpc-init";
import {
	getMuxClient,
	getMuxLibrary,
	generateSignedTokens,
	mapMuxAssetToVideo,
	type MuxAsset,
} from "./shared";

export const playbackRouter = t.router({
	/**
	 * Get assets by collection/tag (using metadata filtering)
	 * Since Mux doesn't have native collections, we filter by metadata
	 */
	getAssetsByCollection: protectedProcedure
		.use(createPermissionMiddleware('mux', ['read']))
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
	 * Batch generate signed tokens for multiple playback IDs
	 * Reduces API calls when loading video grids/lists
	 */
	generateSignedTokensBatch: protectedProcedure
		.use(createPermissionMiddleware('mux', ['read']))
		.input(
			z.object({
				items: z.array(
					z.object({
						playbackId: z.string(),
						expiresIn: z.number().default(3600),
						thumbnailParams: z.object({
							time: z.number().optional(),
							width: z.number().optional(),
							height: z.number().optional(),
							fit_mode: z.string().optional(),
						}).optional(),
						playbackRestrictionId: z.string().optional().nullable(),
					}),
				).max(50), // Limit batch size for performance
				libraryId: z.string().optional(),
			}),
		)
		.query(
			async ({ ctx, input }): Promise<Array<{
				playbackId: string;
				playback: string;
				thumbnail: string;
				storyboard: string;
			}>> => {
				const { env } = ctx;

				try {
					// Get library once for all items
					const library = await getMuxLibrary(env, input.libraryId);

					// Generate tokens for all items in parallel
					const results = await Promise.all(
						input.items.map(async (item) => {
							const effectiveRestrictionId =
								item.playbackRestrictionId !== undefined
									? item.playbackRestrictionId
									: library.defaultPlaybackRestrictionId;

							const tokens = await generateSignedTokens(
								item.playbackId,
								library,
								item.expiresIn,
								item.thumbnailParams,
								effectiveRestrictionId,
							);

							return {
								playbackId: item.playbackId,
								...tokens,
							};
						}),
					);

					return results;
				} catch (error) {
					if (error instanceof TRPCError) throw error;
					console.error("Error generating signed tokens batch:", error);
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to generate signed tokens",
					});
				}
			},
		),

	/**
	 * Generate signed tokens for secure video playback
	 */
	generateSignedTokens: protectedProcedure
		.use(createPermissionMiddleware('mux', ['read']))
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
				// Optional playback restriction ID to enforce domain/user-agent restrictions
				// - undefined: use library's defaultPlaybackRestrictionId (if set)
				// - null: explicitly disable restrictions (override default)
				// - string: use the specified restriction ID
				playbackRestrictionId: z.string().optional().nullable(),
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
					
					// Determine which playback restriction ID to use:
					// - If explicitly provided (string), use it
					// - If explicitly null, don't use any restriction
					// - If undefined, fall back to library's default
					const effectiveRestrictionId = 
						input.playbackRestrictionId !== undefined
							? input.playbackRestrictionId
							: library.defaultPlaybackRestrictionId;
					
					return await generateSignedTokens(
						input.playbackId,
						library,
						input.expiresIn,
						input.thumbnailParams,
						effectiveRestrictionId,
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
		.use(createPermissionMiddleware('mux', ['read']))
		.input(
			z.object({
				playbackId: z.string(),
				libraryId: z.string().optional(),
				expiresIn: z.number().default(3600),
				// Optional playback restriction ID to enforce domain/user-agent restrictions
				// - undefined: use library's defaultPlaybackRestrictionId (if set)
				// - null: explicitly disable restrictions (override default)
				// - string: use the specified restriction ID
				playbackRestrictionId: z.string().optional().nullable(),
			}),
		)
		.query(async ({ ctx, input }): Promise<{ url: string; token?: string }> => {
			const { env } = ctx;

			try {
				const library = await getMuxLibrary(env, input.libraryId);
				
				// For signed playback, generate a signed URL with JWT token
				if (library.signingKeyId && library.signingKeyPrivate) {
					// Determine which playback restriction ID to use
					const effectiveRestrictionId = 
						input.playbackRestrictionId !== undefined
							? input.playbackRestrictionId
							: library.defaultPlaybackRestrictionId;
					
					const tokens = await generateSignedTokens(
						input.playbackId,
						library,
						input.expiresIn,
						undefined, // thumbnailParams
						effectiveRestrictionId,
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
});
