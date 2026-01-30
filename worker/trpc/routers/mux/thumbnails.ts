import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { t, protectedProcedure, createPermissionMiddleware } from "../../trpc-init";
import { getVideosDb } from "./shared";
import { video } from "@/db/video-schema";

// ============================================================================
// Constants
// ============================================================================

const THUMBNAIL_PREFIX = "video-thumbnails";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse a filename into base name and extension
 */
function parseFileName(fileName: string): { baseName: string; ext: string } {
	const lastDot = fileName.lastIndexOf(".");
	if (lastDot === -1) {
		return { baseName: fileName, ext: "" };
	}
	return {
		baseName: fileName.slice(0, lastDot),
		ext: fileName.slice(lastDot + 1),
	};
}

/**
 * Generate a unique key for the thumbnail, handling collisions
 * If the filename exists, adds a numerical suffix (-1, -2, etc.)
 * Format: video-thumbnails/{filename} or video-thumbnails/{filename}-{n}.{ext}
 */
async function generateUniqueThumbnailKey(
	r2Bucket: R2Bucket,
	fileName: string,
): Promise<string> {
	const { baseName, ext } = parseFileName(fileName);
	const baseKey = `${THUMBNAIL_PREFIX}/${fileName}`;

	// Check if the base key exists
	const existingObject = await r2Bucket.head(baseKey);
	if (!existingObject) {
		return baseKey;
	}

	// Key exists, find a unique suffix
	let suffix = 1;
	while (suffix < 1000) {
		// Safety limit to prevent infinite loops
		const newFileName = ext
			? `${baseName}-${suffix}.${ext}`
			: `${baseName}-${suffix}`;
		const newKey = `${THUMBNAIL_PREFIX}/${newFileName}`;

		const exists = await r2Bucket.head(newKey);
		if (!exists) {
			return newKey;
		}
		suffix++;
	}

	// Fallback: use timestamp if we somehow hit 1000 versions
	const timestamp = Date.now();
	const fallbackFileName = ext
		? `${baseName}-${timestamp}.${ext}`
		: `${baseName}-${timestamp}`;
	return `${THUMBNAIL_PREFIX}/${fallbackFileName}`;
}

/**
 * Extract the R2 key from a full URL
 */
function getKeyFromUrl(url: string): string | null {
	try {
		const urlObj = new URL(url);
		// Remove leading slash from pathname
		return urlObj.pathname.slice(1);
	} catch {
		// If it's not a full URL, assume it's already a key
		if (url.startsWith(THUMBNAIL_PREFIX)) {
			return url;
		}
		return null;
	}
}

// ============================================================================
// Thumbnails Router
// ============================================================================

export const thumbnailsRouter = t.router({
	/**
	 * Validate and prepare for thumbnail upload
	 * Returns the key that will be used (with collision handling)
	 */
	getUploadUrl: protectedProcedure
		.use(createPermissionMiddleware('thumbnails', ['write']))
		.input(
			z.object({
				videoId: z.string(),
				libraryId: z.string(),
				fileName: z.string().min(1).max(255),
				mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]),
				fileSize: z.number().max(MAX_FILE_SIZE, {
					message: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
				}),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { videoId, libraryId, fileName, mimeType } = input;

			try {
				// Verify the video exists and belongs to the library
				const [videoRecord] = await db
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

				if (!videoRecord) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Video not found",
					});
				}

				// Generate a unique key for the thumbnail (handles collisions)
				const key = await generateUniqueThumbnailKey(env.R2_ASSETS, fileName);

				return {
					key,
					mimeType,
					maxFileSize: MAX_FILE_SIZE,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error generating upload URL:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to generate upload URL",
				});
			}
		}),

	/**
	 * Upload a custom thumbnail image to R2
	 * Accepts base64 encoded image data
	 */
	uploadThumbnail: protectedProcedure
		.use(createPermissionMiddleware('thumbnails', ['write']))
		.input(
			z.object({
				videoId: z.string(),
				libraryId: z.string(),
				fileName: z.string().min(1).max(255),
				imageData: z.string(), // Base64 encoded image data
				mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { videoId, libraryId, fileName, imageData, mimeType } = input;

			try {
				// Verify the video exists and get current thumbnail URL for cleanup
				const [videoRecord] = await db
					.select({
						id: video.id,
						customThumbnailUrl: video.customThumbnailUrl,
					})
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
						message: "Video not found",
					});
				}

				// Decode base64 image data
				const binaryData = Uint8Array.from(atob(imageData), (c) =>
					c.charCodeAt(0),
				);

				// Validate file size
				if (binaryData.length > MAX_FILE_SIZE) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
					});
				}

				// Generate unique key for the new thumbnail (handles filename collisions)
				const key = await generateUniqueThumbnailKey(env.R2_ASSETS, fileName);

				// Upload to R2
				await env.R2_ASSETS.put(key, binaryData, {
					httpMetadata: {
						contentType: mimeType,
						cacheControl: "public, max-age=31536000", // 1 year cache
					},
					customMetadata: {
						videoId,
						libraryId,
						uploadedAt: new Date().toISOString(),
					},
				});

				// Build the public URL for the thumbnail
				// Note: This assumes you have a custom domain or public access configured for R2
				// Adjust the URL format based on your R2 bucket configuration
				const thumbnailUrl = `https://assets.airwartrail.com/${key}`;

				// Delete the old thumbnail if it exists
				if (videoRecord.customThumbnailUrl) {
					const oldKey = getKeyFromUrl(videoRecord.customThumbnailUrl);
					if (oldKey) {
						try {
							await env.R2_ASSETS.delete(oldKey);
						} catch (deleteError) {
							// Log but don't fail - the new thumbnail is already uploaded
							console.warn("Failed to delete old thumbnail:", deleteError);
						}
					}
				}

				// Update the video record with the new thumbnail URL
				await db
					.update(video)
					.set({
						customThumbnailUrl: thumbnailUrl,
					})
					.where(eq(video.id, videoId));

				return {
					success: true,
					thumbnailUrl,
					key,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error uploading thumbnail:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to upload thumbnail",
				});
			}
		}),

	/**
	 * Delete a custom thumbnail from R2 and clear the database reference
	 */
	deleteThumbnail: protectedProcedure
		.use(createPermissionMiddleware('thumbnails', ['delete']))
		.input(
			z.object({
				videoId: z.string(),
				libraryId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { videoId, libraryId } = input;

			try {
				// Get the current thumbnail URL
				const [videoRecord] = await db
					.select({
						id: video.id,
						customThumbnailUrl: video.customThumbnailUrl,
					})
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
						message: "Video not found",
					});
				}

				if (!videoRecord.customThumbnailUrl) {
					// No thumbnail to delete
					return { success: true, deleted: false };
				}

				// Extract the R2 key from the URL
				const key = getKeyFromUrl(videoRecord.customThumbnailUrl);

				if (key) {
					// Delete from R2
					try {
						await env.R2_ASSETS.delete(key);
					} catch (deleteError) {
						console.warn("Failed to delete thumbnail from R2:", deleteError);
						// Continue to clear the database reference even if R2 delete fails
					}
				}

				// Clear the thumbnail URL in the database
				await db
					.update(video)
					.set({
						customThumbnailUrl: null,
					})
					.where(eq(video.id, videoId));

				return { success: true, deleted: true };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error deleting thumbnail:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete thumbnail",
				});
			}
		}),

	/**
	 * Get the custom thumbnail URL for a video
	 * Returns null if no custom thumbnail is set
	 */
	getThumbnail: protectedProcedure
		.use(createPermissionMiddleware('thumbnails', ['read']))
		.input(
			z.object({
				videoId: z.string(),
				libraryId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { videoId, libraryId } = input;

			try {
				const [videoRecord] = await db
					.select({
						customThumbnailUrl: video.customThumbnailUrl,
						customThumbnailTime: video.customThumbnailTime,
					})
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
						message: "Video not found",
					});
				}

				return {
					customThumbnailUrl: videoRecord.customThumbnailUrl,
					customThumbnailTime: videoRecord.customThumbnailTime,
					hasCustomThumbnail: !!videoRecord.customThumbnailUrl,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error getting thumbnail:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get thumbnail",
				});
			}
		}),

	/**
	 * Update the custom thumbnail time (for Mux auto-generated thumbnails)
	 * This is separate from the custom uploaded thumbnail
	 */
	updateThumbnailTime: protectedProcedure
		.use(createPermissionMiddleware('thumbnails', ['write']))
		.input(
			z.object({
				videoId: z.string(),
				libraryId: z.string(),
				thumbnailTime: z.number().min(0).nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);
			const { videoId, libraryId, thumbnailTime } = input;

			try {
				// Verify the video exists
				const [videoRecord] = await db
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

				if (!videoRecord) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Video not found",
					});
				}

				// Update the thumbnail time
				await db
					.update(video)
					.set({
						customThumbnailTime: thumbnailTime,
					})
					.where(eq(video.id, videoId));

				return { success: true, thumbnailTime };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error updating thumbnail time:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update thumbnail time",
				});
			}
		}),
});
