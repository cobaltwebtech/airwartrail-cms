import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, inArray, asc } from "drizzle-orm";
import { t, protectedProcedure } from "../../trpc-init";
import { video, videoTrack } from "@/db/video-schema";
import { generateVideoId } from "@/worker/lib/generate-id";
import {
	getVideosDb,
	getMuxClient,
	mapMuxAssetToVideo,
	type MuxAsset,
} from "./shared";

// Import the MuxAssetState type alias
type MuxAssetState = "waiting" | "preparing" | "ready" | "errored";

export const videosRouter = t.router({
	/**
	 * List all assets from Mux (with pagination)
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
	 * List videos from database (with pagination)
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
	 * Delete video by internal database ID
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

	/**
	 * Update playback policy for a video (public or signed)
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
});
