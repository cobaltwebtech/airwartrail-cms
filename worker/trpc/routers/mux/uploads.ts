import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { t, protectedProcedure, createPermissionMiddleware } from "../../trpc-init";
import {
	getMuxClient,
	getLanguageName,
	type DirectUpload,
} from "./shared";

export const uploadsRouter = t.router({
	/**
	 * Create a direct upload URL for resumable uploads
	 */
	createDirectUpload: protectedProcedure
		.use(createPermissionMiddleware('mux', ['write']))
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
		.use(createPermissionMiddleware('mux', ['read']))
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
		.use(createPermissionMiddleware('mux', ['write']))
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
});
