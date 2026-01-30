import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, inArray, asc, desc, sql } from "drizzle-orm";
import { t, protectedProcedure, createPermissionMiddleware } from "../../trpc-init";
import { videoTag, videoTagAssignment, video } from "@/db/video-schema";
import { getVideosDb, createTagSlug } from "./shared";
import { generateTagId, generateVideoTagAssignmentId } from "@/worker/lib/generate-id";

export const tagsRouter = t.router({
	/**
	 * List all tags (active only by default)
	 */
	listTags: protectedProcedure
		.use(createPermissionMiddleware('mux', ['read']))
		.query(async ({ ctx }) => {
		const { env } = ctx;
		const db = getVideosDb(env);

		try {
			const tags = await db
				.select()
				.from(videoTag)
				.where(eq(videoTag.isActive, true))
				.orderBy(asc(videoTag.name));

			return tags;
		} catch (error) {
			if (error instanceof TRPCError) throw error;
			console.error("Error listing tags:", error);
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to list tags",
			});
		}
	}),

	/**
	 * Create a new tag
	 */
	createTag: protectedProcedure
		.use(createPermissionMiddleware('mux', ['write']))
		.input(
			z.object({
				name: z.string().min(1).max(50),
				description: z.string().max(200).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { name, description } = input;

			try {
				const slug = createTagSlug(name);

				// Check if tag with this slug already exists
				const existing = await db
					.select({ id: videoTag.id })
					.from(videoTag)
					.where(eq(videoTag.slug, slug))
					.limit(1);

				if (existing.length > 0) {
					throw new TRPCError({
						code: "CONFLICT",
						message: `Tag with name "${name}" already exists`,
					});
				}

				const tagId = generateTagId();
				const [newTag] = await db
					.insert(videoTag)
					.values({
						id: tagId,
						slug,
						name,
						description: description ?? null,
						isActive: true,
					})
					.returning();

				return newTag;
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error creating tag:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create tag",
				});
			}
		}),

	/**
	 * Update a tag
	 */
	updateTag: protectedProcedure
		.use(createPermissionMiddleware('mux', ['write']))
		.input(
			z.object({
				tagId: z.string(),
				name: z.string().min(1).max(50).optional(),
				description: z.string().max(200).nullable().optional(),
				isActive: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { tagId, ...updates } = input;

			try {
				// Verify tag exists
				const existing = await db
					.select({ id: videoTag.id })
					.from(videoTag)
					.where(eq(videoTag.id, tagId))
					.limit(1);

				if (existing.length === 0) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Tag not found",
					});
				}

				const updateData: Record<string, any> = {};
				if (updates.name !== undefined) {
					updateData.name = updates.name;
					updateData.slug = createTagSlug(updates.name);
				}
				if (updates.description !== undefined) updateData.description = updates.description;
				if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

				const [updated] = await db
					.update(videoTag)
					.set(updateData)
					.where(eq(videoTag.id, tagId))
					.returning();

				return updated;
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error updating tag:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update tag",
				});
			}
		}),

	/**
	 * Delete a tag (soft delete - set isActive to false)
	 */
	deleteTag: protectedProcedure
		.use(createPermissionMiddleware('mux', ['delete']))
		.input(
			z.object({
				tagId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { tagId } = input;

			try {
				await db
					.update(videoTag)
					.set({ isActive: false })
					.where(eq(videoTag.id, tagId));

				return { success: true };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error deleting tag:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete tag",
				});
			}
		}),

	/**
	 * Assign tags to a video (replaces existing tags)
	 */
	setVideoTags: protectedProcedure
		.use(createPermissionMiddleware('mux', ['write']))
		.input(
			z.object({
				videoId: z.string(),
				libraryId: z.string(),
				tagIds: z.array(z.string()).max(20), // Reasonable limit
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { videoId, libraryId, tagIds } = input;

			try {
				// Verify video exists
				const existingVideo = await db
					.select({ id: video.id })
					.from(video)
					.where(
						and(
							eq(video.id, videoId),
							eq(video.libraryId, libraryId),
						),
					)
					.limit(1);

				if (existingVideo.length === 0) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Video not found",
					});
				}

				// Verify all tags exist and are active
				if (tagIds.length > 0) {
					const validTags = await db
						.select({ id: videoTag.id })
						.from(videoTag)
						.where(
							and(
								inArray(videoTag.id, tagIds),
								eq(videoTag.isActive, true),
							),
						);

					if (validTags.length !== tagIds.length) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "One or more tags not found or inactive",
						});
					}
				}

				// Delete existing tag assignments
				await db
					.delete(videoTagAssignment)
					.where(eq(videoTagAssignment.videoId, videoId));

				// Create new assignments
				if (tagIds.length > 0) {
					const assignments = tagIds.map((tagId) => ({
						id: generateVideoTagAssignmentId(),
						videoId,
						tagId,
					}));

					await db.insert(videoTagAssignment).values(assignments);
				}

				// Fetch and return the updated tags
				const updatedTags = await db
					.select({
						id: videoTag.id,
						slug: videoTag.slug,
						name: videoTag.name,
						description: videoTag.description,
					})
					.from(videoTag)
					.innerJoin(
						videoTagAssignment,
						eq(videoTag.id, videoTagAssignment.tagId),
					)
					.where(eq(videoTagAssignment.videoId, videoId));

				return updatedTags;
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error setting video tags:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to set video tags",
				});
			}
		}),

	/**
	 * Get tags for a specific video
	 */
	getVideoTags: protectedProcedure
		.use(createPermissionMiddleware('mux', ['read']))
		.input(
			z.object({
				videoId: z.string(),
				libraryId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { videoId } = input;

			try {
				const tags = await db
					.select({
						id: videoTag.id,
						slug: videoTag.slug,
						name: videoTag.name,
						description: videoTag.description,
					})
					.from(videoTag)
					.innerJoin(
						videoTagAssignment,
						eq(videoTag.id, videoTagAssignment.tagId),
					)
					.where(
						and(
							eq(videoTagAssignment.videoId, videoId),
							eq(videoTag.isActive, true),
						),
					)
					.orderBy(asc(videoTag.name));

				return tags;
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error getting video tags:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get video tags",
				});
			}
		}),

	/**
	 * Search videos by tag(s)
	 */
	searchVideosByTags: protectedProcedure
		.use(createPermissionMiddleware('mux', ['read']))
		.input(
			z.object({
				libraryId: z.string(),
				tagIds: z.array(z.string()).min(1),
				matchMode: z.enum(["any", "all"]).default("any"), // any = OR, all = AND
				limit: z.number().min(1).max(100).default(50),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { libraryId, tagIds, matchMode, limit, offset } = input;

			try {
				if (matchMode === "all") {
					// For "all" mode, we need videos that have ALL specified tags
					const results = await db
						.select({
							id: video.id,
							title: video.title,
							description: video.description,
							muxPlaybackId: video.muxPlaybackId,
							playbackPolicy: video.playbackPolicy,
							duration: video.duration,
							createdAt: video.createdAt,
							tagCount: sql<number>`COUNT(DISTINCT ${videoTag.id})`,
						})
						.from(video)
						.innerJoin(
							videoTagAssignment,
							eq(video.id, videoTagAssignment.videoId),
						)
						.innerJoin(
							videoTag,
							eq(videoTagAssignment.tagId, videoTag.id),
						)
						.where(
							and(
								eq(video.libraryId, libraryId),
								eq(video.isDeleted, false),
								inArray(videoTag.id, tagIds),
							),
						)
						.groupBy(video.id)
						.having(sql`COUNT(DISTINCT ${videoTag.id}) = ${tagIds.length}`)
						.orderBy(desc(video.createdAt))
						.limit(limit)
						.offset(offset);

					return results;
				} else {
					// For "any" mode, videos that have at least one of the specified tags
					const results = await db
						.selectDistinct({
							id: video.id,
							title: video.title,
							description: video.description,
							muxPlaybackId: video.muxPlaybackId,
							playbackPolicy: video.playbackPolicy,
							duration: video.duration,
							createdAt: video.createdAt,
						})
						.from(video)
						.innerJoin(
							videoTagAssignment,
							eq(video.id, videoTagAssignment.videoId),
						)
						.innerJoin(
							videoTag,
							eq(videoTagAssignment.tagId, videoTag.id),
						)
						.where(
							and(
								eq(video.libraryId, libraryId),
								eq(video.isDeleted, false),
								inArray(videoTag.id, tagIds),
							),
						)
						.orderBy(desc(video.createdAt))
						.limit(limit)
						.offset(offset);

					return results;
				}
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error searching videos by tags:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to search videos",
				});
			}
		}),

	/**
	 * Get tag statistics (usage counts)
	 */
	getTagStatistics: protectedProcedure
		.use(createPermissionMiddleware('mux', ['read']))
		.input(
			z.object({
				libraryId: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { libraryId } = input;

			try {
				let query = db
					.select({
						tagId: videoTag.id,
						tagSlug: videoTag.slug,
						tagName: videoTag.name,
						videoCount: sql<number>`COUNT(DISTINCT ${videoTagAssignment.videoId})`,
					})
					.from(videoTag)
					.leftJoin(
						videoTagAssignment,
						eq(videoTag.id, videoTagAssignment.tagId),
					)
					.where(eq(videoTag.isActive, true));

				// If libraryId is provided, filter by library
				if (libraryId) {
					query = query
						.leftJoin(
							video,
							and(
								eq(videoTagAssignment.videoId, video.id),
								eq(video.libraryId, libraryId),
							),
						);
				}

				const stats = await query
					.groupBy(videoTag.id)
					.orderBy(desc(sql<number>`COUNT(DISTINCT ${videoTagAssignment.videoId})`));

				return stats;
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error getting tag statistics:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get tag statistics",
				});
			}
		}),
});
