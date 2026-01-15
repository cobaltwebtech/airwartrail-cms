import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { t, protectedProcedure } from "../../trpc-init";
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
});
