import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { t, protectedProcedure } from "../../trpc-init";
import { eq, and } from "drizzle-orm";
import { video, videoTrack } from "@/db/video-schema";
import { generateTrackId } from "@/worker/lib/generate-id";
import {
	getMuxClient,
	getVideosDb,
	getLanguageName,
	type MuxTrack,
} from "./shared";

export const captionsRouter = t.router({
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
});
