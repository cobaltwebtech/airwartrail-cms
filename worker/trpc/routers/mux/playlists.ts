import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, inArray, asc, desc, sql } from "drizzle-orm";
import { t, protectedProcedure, createPermissionMiddleware } from "../../trpc-init";
import { playlist, playlistItem, video } from "@/db/video-schema";
import { generatePlaylistId, generatePlaylistItemId } from "@/worker/lib/generate-id";
import { getVideosDb, getMuxLibrary } from "./shared";

export const playlistsRouter = t.router({
	/**
	 * Create a new playlist
	 */
	createPlaylist: protectedProcedure
		.use(createPermissionMiddleware('playlists', ['write']))
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
	 * Optimized with LEFT JOINs to consolidate queries and avoid N+1 patterns
	 */
	listPlaylists: protectedProcedure
		.use(createPermissionMiddleware('playlists', ['read']))
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

				// Single query with LEFT JOIN to get playlists with video counts
				// This eliminates the separate video count query
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
						// Include video count via LEFT JOIN aggregation
						videoCount: sql<number>`COUNT(DISTINCT ${playlistItem.id})`.as('video_count'),
					})
					.from(playlist)
					.leftJoin(playlistItem, eq(playlist.id, playlistItem.playlistId))
					.where(and(...conditions))
					.groupBy(playlist.id)
					.orderBy(asc(playlist.sortOrder), desc(playlist.createdAt))
					.limit(limit)
					.offset(offset);

				// Batch fetch thumbnail info for all playlists in one query
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

				// Batch fetch first video for playlists without explicit thumbnail
				// Use a single query with ROW_NUMBER() window function pattern via subquery
				const playlistsNeedingFirstVideo = playlists.filter((p) => !p.thumbnailVideoId);
				const firstVideoMap = new Map<string, { playbackId: string | null; policy: string | null }>();

				if (playlistsNeedingFirstVideo.length > 0) {
					const playlistIdsNeedingThumbnail = playlistsNeedingFirstVideo.map((p) => p.id);
					
					// For D1/SQLite, use a correlated subquery approach with MIN to get first video
					// This batch-fetches first videos for all playlists in one query
					const firstVideos = await db
						.select({
							playlistId: playlistItem.playlistId,
							muxPlaybackId: video.muxPlaybackId,
							playbackPolicy: video.playbackPolicy,
							sortOrder: playlistItem.sortOrder,
						})
						.from(playlistItem)
						.innerJoin(video, eq(playlistItem.videoId, video.id))
						.where(
							and(
								inArray(playlistItem.playlistId, playlistIdsNeedingThumbnail),
								eq(video.isDeleted, false),
								// Use subquery to get only the first video (min sortOrder) per playlist
								sql`${playlistItem.sortOrder} = (
									SELECT MIN(pi2.sort_order) 
									FROM playlist_item pi2 
									INNER JOIN video v2 ON pi2.video_id = v2.id
									WHERE pi2.playlist_id = ${playlistItem.playlistId}
									AND v2.is_deleted = 0
								)`,
							),
						);

					for (const fv of firstVideos) {
						firstVideoMap.set(fv.playlistId, {
							playbackId: fv.muxPlaybackId,
							policy: fv.playbackPolicy,
						});
					}
				}

				return playlists.map((p) => {
					const thumbnailInfo = p.thumbnailVideoId
						? thumbnailMap.get(p.thumbnailVideoId)
						: firstVideoMap.get(p.id);

					return {
						...p,
						customMetadata: p.customMetadata ? JSON.parse(p.customMetadata) : null,
						videoCount: p.videoCount ?? 0,
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
		.use(createPermissionMiddleware('playlists', ['read']))
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
					addedAt: Date; // Date when video is added to playlist
					createdAt: Date; // Upload date of the video
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
							createdAt: video.createdAt,
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
		.use(createPermissionMiddleware('playlists', ['write']))
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
	 * Delete a playlist (hard delete)
	 * Permanently removes the playlist and all associated playlist items from the database
	 */
	deletePlaylist: protectedProcedure
		.use(createPermissionMiddleware('playlists', ['delete']))
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
						),
					)
					.limit(1);

				if (!existingPlaylist) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Playlist not found",
					});
				}

				await db.delete(playlist).where(eq(playlist.id, playlistId));

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
	 * Publish or unpublish a playlist
	 */
	setPlaylistPublishStatus: protectedProcedure
		.use(createPermissionMiddleware('playlists', ['write']))
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
	 * Add a video to a playlist
	 */
	addVideoToPlaylist: protectedProcedure
		.use(createPermissionMiddleware('playlists', ['write']))
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
		.use(createPermissionMiddleware('playlists', ['write']))
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
		.use(createPermissionMiddleware('playlists', ['write']))
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
		.use(createPermissionMiddleware('playlists', ['write']))
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
		.use(createPermissionMiddleware('playlists', ['write']))
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
