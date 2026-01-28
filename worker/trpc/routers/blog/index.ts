import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, asc, sql, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { t, protectedProcedure, publicProcedure } from "../../trpc-init";
import { posts } from "@/db/blog-schema";
import { customAlphabet } from "nanoid";

// ============================================================================
// Database Helper
// ============================================================================

export function getBlogDb(env: Env) {
	return drizzle(env.DB_BLOG);
}

// ============================================================================
// Featured Image Constants & Helpers
// ============================================================================

const BLOG_ASSETS_PREFIX = "blog";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

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
 * Generate a unique key for the featured image, handling collisions
 * Format: blog/{filename} or blog/{filename}-{n}.{ext}
 */
async function generateUniqueFeaturedImageKey(
	r2Bucket: R2Bucket,
	fileName: string,
): Promise<string> {
	const { baseName, ext } = parseFileName(fileName);
	const baseKey = `${BLOG_ASSETS_PREFIX}/${fileName}`;

	// Check if the base key exists
	const existingObject = await r2Bucket.head(baseKey);
	if (!existingObject) {
		return baseKey;
	}

	// Key exists, find a unique suffix
	let suffix = 1;
	while (suffix < 1000) {
		const newFileName = ext
			? `${baseName}-${suffix}.${ext}`
			: `${baseName}-${suffix}`;
		const newKey = `${BLOG_ASSETS_PREFIX}/${newFileName}`;

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
	return `${BLOG_ASSETS_PREFIX}/${fallbackFileName}`;
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
		if (url.startsWith(BLOG_ASSETS_PREFIX)) {
			return url;
		}
		return null;
	}
}

// ============================================================================
// ID Generation
// ============================================================================

export const generatePostId = customAlphabet(
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
	16,
);

// ============================================================================
// Types
// ============================================================================

export type PublishStatus = "draft" | "published" | "scheduled" | "archived";

export interface Post {
	id: string;
	slug: string;
	title: string;
	shortDescription: string | null;
	postContent: unknown;
	featuredImageUrl: string | null;
	featuredImageAlt: string | null;
	publishStatus: PublishStatus;
	publishedAt: Date | null;
	author: string;
	authorId: string | null;
	isFeatured: boolean;
	readingTimeMinutes: number | null;
	createdAt: Date;
	updatedAt: Date;
}

// ============================================================================
// Schemas
// ============================================================================

const publishStatusSchema = z.enum(["draft", "published", "scheduled", "archived"]);

const postContentSchema = z.unknown(); // JSON content from rich text editor

const createPostSchema = z.object({
	slug: z.string().min(1).max(255),
	title: z.string().min(1).max(255),
	shortDescription: z.string().max(100).optional(),
	postContent: postContentSchema.optional(),
	featuredImageUrl: z.url().optional(),
	featuredImageAlt: z.string().max(255).optional(),
	publishStatus: publishStatusSchema.default("draft"),
	publishedAt: z.date().optional(),
	isFeatured: z.boolean().default(false),
	readingTimeMinutes: z.number().int().positive().optional(),
});

const updatePostSchema = z.object({
	id: z.string(),
	slug: z.string().min(1).max(255).optional(),
	title: z.string().min(1).max(255).optional(),
	shortDescription: z.string().max(100).nullable().optional(),
	postContent: postContentSchema.optional(),
	featuredImageUrl: z.url().nullable().optional(),
	featuredImageAlt: z.string().max(255).nullable().optional(),
	publishStatus: publishStatusSchema.optional(),
	publishedAt: z.date().nullable().optional(),
	isFeatured: z.boolean().optional(),
	readingTimeMinutes: z.number().int().positive().nullable().optional(),
});

const getPostSchema = z.object({
	id: z.string().optional(),
	slug: z.string().optional(),
}).refine((data) => data.id || data.slug, {
	message: "Either id or slug must be provided",
});

const listPostsSchema = z.object({
	limit: z.number().min(1).max(100).default(25),
	page: z.number().min(1).default(1),
	status: publishStatusSchema.optional(),
	search: z.string().optional(),
	sortBy: z.enum(["createdAt", "updatedAt", "publishedAt", "title"]).default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
	featuredOnly: z.boolean().default(false),
});

const deletePostSchema = z.object({
	id: z.string(),
});



// ============================================================================
// Blog Router
// ============================================================================

export const blogRouter = t.router({
	/**
	 * Create a new blog post
	 */
	create: protectedProcedure
		.input(createPostSchema)
		.mutation(async ({ ctx, input }) => {
			const db = getBlogDb(ctx.env);

			// Check if slug already exists
			const existingPost = await db
				.select({ id: posts.id })
				.from(posts)
				.where(eq(posts.slug, input.slug))
				.limit(1);

			if (existingPost.length > 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "A post with this slug already exists",
				});
			}

			const postId = generatePostId();
			const now = new Date();

			// Set publishedAt if status is published and not provided
			const publishedAt =
				input.publishStatus === "published" && !input.publishedAt
					? now
					: input.publishedAt ?? null;

			const [newPost] = await db
				.insert(posts)
				.values({
					id: postId,
					slug: input.slug,
					title: input.title,
					short_description: input.shortDescription ?? null,
					postContent: input.postContent ?? null,
					featuredImageUrl: input.featuredImageUrl ?? null,
					featuredImageAlt: input.featuredImageAlt ?? null,
					publishStatus: input.publishStatus,
					publishedAt,
					author: ctx.user.name,
					authorId: ctx.user.id,
					isFeatured: input.isFeatured,
					readingTimeMinutes: input.readingTimeMinutes ?? null,
				})
				.returning();

			return {
				id: newPost.id,
				slug: newPost.slug,
				title: newPost.title,
				shortDescription: newPost.short_description,
				postContent: newPost.postContent,
				featuredImageUrl: newPost.featuredImageUrl,
				featuredImageAlt: newPost.featuredImageAlt,
				publishStatus: newPost.publishStatus as PublishStatus,
				publishedAt: newPost.publishedAt,
				author: newPost.author,
				authorId: newPost.authorId,
				isFeatured: newPost.isFeatured,
				readingTimeMinutes: newPost.readingTimeMinutes,
				createdAt: newPost.createdAt,
				updatedAt: newPost.updatedAt,
			};
		}),

	/**
	 * Update an existing blog post
	 */
	update: protectedProcedure
		.input(updatePostSchema)
		.mutation(async ({ ctx, input }) => {
			const db = getBlogDb(ctx.env);

			// Check if post exists
			const [existingPost] = await db
				.select()
				.from(posts)
				.where(eq(posts.id, input.id))
				.limit(1);

			if (!existingPost) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Post not found",
				});
			}

			// Check if new slug already exists (if slug is being changed)
			if (input.slug && input.slug !== existingPost.slug) {
				const slugExists = await db
					.select({ id: posts.id })
					.from(posts)
					.where(eq(posts.slug, input.slug))
					.limit(1);

				if (slugExists.length > 0) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "A post with this slug already exists",
					});
				}
			}

			// Handle publishedAt auto-set when publishing
			let publishedAt = input.publishedAt;
			if (
				input.publishStatus === "published" &&
				existingPost.publishStatus !== "published" &&
				publishedAt === undefined
			) {
				publishedAt = new Date();
			}

			const updateData: Record<string, unknown> = {};

			if (input.slug !== undefined) updateData.slug = input.slug;
			if (input.title !== undefined) updateData.title = input.title;
			if (input.shortDescription !== undefined) updateData.short_description = input.shortDescription;
			if (input.postContent !== undefined) updateData.postContent = input.postContent;
			if (input.featuredImageUrl !== undefined) updateData.featuredImageUrl = input.featuredImageUrl;
			if (input.featuredImageAlt !== undefined) updateData.featuredImageAlt = input.featuredImageAlt;
			if (input.publishStatus !== undefined) updateData.publishStatus = input.publishStatus;
			if (publishedAt !== undefined) updateData.publishedAt = publishedAt;
			if (input.isFeatured !== undefined) updateData.isFeatured = input.isFeatured;
			if (input.readingTimeMinutes !== undefined) updateData.readingTimeMinutes = input.readingTimeMinutes;

			const [updatedPost] = await db
				.update(posts)
				.set(updateData)
				.where(eq(posts.id, input.id))
				.returning();

			return {
				id: updatedPost.id,
				slug: updatedPost.slug,
				title: updatedPost.title,
				shortDescription: updatedPost.short_description,
				postContent: updatedPost.postContent,
				featuredImageUrl: updatedPost.featuredImageUrl,
				featuredImageAlt: updatedPost.featuredImageAlt,
				publishStatus: updatedPost.publishStatus as PublishStatus,
				publishedAt: updatedPost.publishedAt,
				author: updatedPost.author,
				authorId: updatedPost.authorId,
				isFeatured: updatedPost.isFeatured,
				readingTimeMinutes: updatedPost.readingTimeMinutes,
				createdAt: updatedPost.createdAt,
				updatedAt: updatedPost.updatedAt,
			};
		}),

	/**
	 * Get a single blog post by ID or slug
	 */
	get: publicProcedure.input(getPostSchema).query(async ({ ctx, input }) => {
		const db = getBlogDb(ctx.env);

		const condition = input.id
			? eq(posts.id, input.id)
			: eq(posts.slug, input.slug!);

		const [post] = await db.select().from(posts).where(condition).limit(1);

		if (!post) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Post not found",
			});
		}

		return {
			id: post.id,
			slug: post.slug,
			title: post.title,
			shortDescription: post.short_description,
			postContent: post.postContent,
			featuredImageUrl: post.featuredImageUrl,
			featuredImageAlt: post.featuredImageAlt,
			publishStatus: post.publishStatus as PublishStatus,
			publishedAt: post.publishedAt,
			author: post.author,
			authorId: post.authorId,
			isFeatured: post.isFeatured,
			readingTimeMinutes: post.readingTimeMinutes,
			createdAt: post.createdAt,
			updatedAt: post.updatedAt,
		};
	}),

	/**
	 * List blog posts with filtering and pagination
	 */
	list: publicProcedure.input(listPostsSchema.optional()).query(async ({ ctx, input }) => {
		const db = getBlogDb(ctx.env);

		const limit = input?.limit ?? 25;
		const page = input?.page ?? 1;
		const offset = (page - 1) * limit;

		// Build where conditions
		const conditions = [];

		if (input?.status) {
			conditions.push(eq(posts.publishStatus, input.status));
		}

		if (input?.featuredOnly) {
			conditions.push(eq(posts.isFeatured, true));
		}

		if (input?.search) {
			const searchPattern = `%${input.search}%`;
			conditions.push(
				or(like(posts.title, searchPattern), like(posts.slug, searchPattern)),
			);
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Build order by
		const sortColumn = {
			createdAt: posts.createdAt,
			updatedAt: posts.updatedAt,
			publishedAt: posts.publishedAt,
			title: posts.title,
		}[input?.sortBy ?? "createdAt"];

		const sortFn = input?.sortOrder === "asc" ? asc : desc;

		// Get posts
		const results = await db
			.select()
			.from(posts)
			.where(whereClause)
			.orderBy(sortFn(sortColumn))
			.limit(limit)
			.offset(offset);

		// Get total count
		const [countResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(posts)
			.where(whereClause);

		const total = countResult?.count ?? 0;

		return {
			posts: results.map((post) => ({
				id: post.id,
				slug: post.slug,
				title: post.title,
				shortDescription: post.short_description,
				postContent: post.postContent,
				featuredImageUrl: post.featuredImageUrl,
				featuredImageAlt: post.featuredImageAlt,
				publishStatus: post.publishStatus as PublishStatus,
				publishedAt: post.publishedAt,
				author: post.author,
				authorId: post.authorId,
				isFeatured: post.isFeatured,
				readingTimeMinutes: post.readingTimeMinutes,
				createdAt: post.createdAt,
				updatedAt: post.updatedAt,

			})),
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
				hasNext: page * limit < total,
				hasPrev: page > 1,
			},
		};
	}),

	/**
	 * Delete a blog post
	 */
	delete: protectedProcedure
		.input(deletePostSchema)
		.mutation(async ({ ctx, input }) => {
			const db = getBlogDb(ctx.env);

			// Check if post exists
			const [existingPost] = await db
				.select({ id: posts.id })
				.from(posts)
				.where(eq(posts.id, input.id))
				.limit(1);

			if (!existingPost) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Post not found",
				});
			}

			// Delete post
			await db.delete(posts).where(eq(posts.id, input.id));

			return {
				success: true,
				message: "Post deleted",
				id: input.id,
			};
		}),



	/**
	 * Publish a blog post
	 */
	publish: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const db = getBlogDb(ctx.env);

			const [existingPost] = await db
				.select()
				.from(posts)
				.where(eq(posts.id, input.id))
				.limit(1);

			if (!existingPost) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Post not found",
				});
			}

			const now = new Date();
			const publishedAt = existingPost.publishedAt ?? now;

			const [updatedPost] = await db
				.update(posts)
				.set({
					publishStatus: "published",
					publishedAt,
				})
				.where(eq(posts.id, input.id))
				.returning();

			return {
				id: updatedPost.id,
				slug: updatedPost.slug,
				title: updatedPost.title,
				publishStatus: updatedPost.publishStatus as PublishStatus,
				publishedAt: updatedPost.publishedAt,
			};
		}),

	/**
	 * Unpublish a blog post (move to draft)
	 */
	unpublish: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const db = getBlogDb(ctx.env);

			const [existingPost] = await db
				.select()
				.from(posts)
				.where(eq(posts.id, input.id))
				.limit(1);

			if (!existingPost) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Post not found",
				});
			}

			const [updatedPost] = await db
				.update(posts)
				.set({
					publishStatus: "draft",
				})
				.where(eq(posts.id, input.id))
				.returning();

			return {
				id: updatedPost.id,
				slug: updatedPost.slug,
				title: updatedPost.title,
				publishStatus: updatedPost.publishStatus as PublishStatus,
				publishedAt: updatedPost.publishedAt,
			};
		}),

	/**
	 * Toggle featured status
	 */
	toggleFeatured: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const db = getBlogDb(ctx.env);

			const [existingPost] = await db
				.select({ id: posts.id, isFeatured: posts.isFeatured })
				.from(posts)
				.where(eq(posts.id, input.id))
				.limit(1);

			if (!existingPost) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Post not found",
				});
			}

			const [updatedPost] = await db
				.update(posts)
				.set({
					isFeatured: !existingPost.isFeatured,
				})
				.where(eq(posts.id, input.id))
				.returning();

			return {
				id: updatedPost.id,
				isFeatured: updatedPost.isFeatured,
			};
		}),

	/**
	 * Upload a featured image to R2 and store the URL in the database
	 * Accepts base64 encoded image data
	 */
	uploadFeaturedImage: protectedProcedure
		.input(
			z.object({
				postId: z.string(),
				fileName: z.string().min(1).max(255),
				imageData: z.string(), // Base64 encoded image data
				mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getBlogDb(env);
			const { postId, fileName, imageData, mimeType } = input;

			try {
				// Verify the post exists and get current featured image URL for cleanup
				const [existingPost] = await db
					.select({
						id: posts.id,
						featuredImageUrl: posts.featuredImageUrl,
					})
					.from(posts)
					.where(eq(posts.id, postId))
					.limit(1);

				if (!existingPost) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Post not found",
					});
				}

				// Decode base64 image data
				const binaryData = Uint8Array.from(atob(imageData), (c) =>
					c.charCodeAt(0),
				);

				// Validate file size
				if (binaryData.length > MAX_IMAGE_SIZE) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `File size exceeds maximum of ${MAX_IMAGE_SIZE / 1024 / 1024}MB`,
					});
				}

				// Generate unique key for the new featured image (handles filename collisions)
				const key = await generateUniqueFeaturedImageKey(env.R2_ASSETS, fileName);

				// Upload to R2
				await env.R2_ASSETS.put(key, binaryData, {
					httpMetadata: {
						contentType: mimeType,
						cacheControl: "public, max-age=31536000", // 1 year cache
					},
					customMetadata: {
						postId,
						uploadedAt: new Date().toISOString(),
					},
				});

				// Build the public URL for the featured image
				const featuredImageUrl = `https://assets.airwartrail.com/${key}`;

				// Delete the old featured image if it exists
				if (existingPost.featuredImageUrl) {
					const oldKey = getKeyFromUrl(existingPost.featuredImageUrl);
					if (oldKey) {
						try {
							await env.R2_ASSETS.delete(oldKey);
						} catch (deleteError) {
							// Log but don't fail - the new image is already uploaded
							console.warn("Failed to delete old featured image:", deleteError);
						}
					}
				}

				// Update the post record with the new featured image URL
				const [updatedPost] = await db
					.update(posts)
					.set({
						featuredImageUrl,
					})
					.where(eq(posts.id, postId))
					.returning();

				return {
					success: true,
					featuredImageUrl,
					key,
					postId: updatedPost.id,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error uploading featured image:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to upload featured image",
				});
			}
		}),

	/**
	 * Delete a featured image from R2 and clear the database reference
	 */
	deleteFeaturedImage: protectedProcedure
		.input(
			z.object({
				postId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getBlogDb(env);
			const { postId } = input;

			try {
				// Get the current featured image URL
				const [existingPost] = await db
					.select({
						id: posts.id,
						featuredImageUrl: posts.featuredImageUrl,
					})
					.from(posts)
					.where(eq(posts.id, postId))
					.limit(1);

				if (!existingPost) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Post not found",
					});
				}

				if (!existingPost.featuredImageUrl) {
					// No featured image to delete
					return { success: true, deleted: false };
				}

				// Extract the R2 key from the URL
				const key = getKeyFromUrl(existingPost.featuredImageUrl);

				if (key) {
					// Delete from R2
					try {
						await env.R2_ASSETS.delete(key);
					} catch (deleteError) {
						console.warn("Failed to delete featured image from R2:", deleteError);
						// Continue to clear the database reference even if R2 delete fails
					}
				}

				// Clear the featured image URL in the database
				await db
					.update(posts)
					.set({
						featuredImageUrl: null,
					})
					.where(eq(posts.id, postId));

				return { success: true, deleted: true };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error deleting featured image:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete featured image",
				});
			}
		}),
});
