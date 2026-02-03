import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, asc } from "drizzle-orm";
import { t, protectedProcedure, createPermissionMiddleware } from "../../trpc-init";
import { videoChapter, video } from "@/db/video-schema";
import { getVideosDb } from "./shared";
import { generateChapterId } from "@/worker/lib/generate-id";

export const chaptersRouter = t.router({
	/**
	 * Get chapters for a video by internal video ID
	 * Optimized with INNER JOIN to verify video exists and fetch chapters in one query
	 */
	getChapters: protectedProcedure
		.use(createPermissionMiddleware('mux', ['read']))
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

			try {
				// Single query with INNER JOIN to verify video exists and fetch chapters
				// The JOIN implicitly verifies the video exists - if no video matches, no rows returned
				const chapters = await db
					.select({
						id: videoChapter.id,
						title: videoChapter.title,
						startTime: videoChapter.startTime,
						endTime: videoChapter.endTime,
						sortOrder: videoChapter.sortOrder,
						thumbnailTime: videoChapter.thumbnailTime,
					})
					.from(videoChapter)
					.innerJoin(video, eq(videoChapter.videoId, video.id))
					.where(
						libraryId
							? and(
									eq(video.id, videoId),
									eq(video.libraryId, libraryId),
									eq(video.isDeleted, false),
								)
							: and(
									eq(video.id, videoId),
									eq(video.isDeleted, false),
								),
					)
					.orderBy(asc(videoChapter.sortOrder), asc(videoChapter.startTime));

				return chapters;
			} catch (error) {
				console.error("Error getting chapters:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get chapters",
				});
			}
		}),

	/**
	 * Save chapters for a video by internal video ID (replace all existing chapters)
	 */
	saveChapters: protectedProcedure
		.use(createPermissionMiddleware('mux', ['write']))
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

			try {
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
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error saving chapters:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to save chapters",
				});
			}
		}),

	/**
	 * Delete a single chapter
	 */
	deleteChapter: protectedProcedure
		.use(createPermissionMiddleware('mux', ['delete']))
		.input(
			z.object({
				chapterId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const { chapterId } = input;

			const db = getVideosDb(env);

			try {
				await db.delete(videoChapter).where(eq(videoChapter.id, chapterId));

				return { success: true };
			} catch (error) {
				console.error("Error deleting chapter:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete chapter",
				});
			}
		}),
});
