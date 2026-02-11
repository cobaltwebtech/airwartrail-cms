import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, asc, sql, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { t, protectedProcedure, publicProcedure, createPermissionMiddleware } from "../../trpc-init";
import { blogPosts } from "@/db/content-schema";
import { customAlphabet } from "nanoid";

// ============================================================================
// Database Helper
// ============================================================================

export function getBlogDb(env: Env) {
	return drizzle(env.DB_CONTENT);
}

// ============================================================================
// ID Generation
// ============================================================================

export const generatePostId = customAlphabet(
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
	16,
);

// ============================================================================
// Reading Time Calculation
// ============================================================================

const WORDS_PER_MINUTE = 200;

/**
 * Extract plain text from Tiptap JSON content structure
 */
function extractTextFromTiptap(content: unknown): string {
	if (!content || typeof content !== 'object') {
		return '';
	}

	let text = '';

	// Handle text nodes
	if ('text' in content && typeof content.text === 'string') {
		text += content.text;
	}

	// Recursively process content array
	if ('content' in content && Array.isArray(content.content)) {
		for (const node of content.content) {
			text += extractTextFromTiptap(node);
			text += ' '; // Add space between nodes
		}
	}

	return text;
}

/**
 * Calculate reading time in minutes from Tiptap JSON content
 */
function calculateReadingTime(postContent: unknown): number {
	const text = extractTextFromTiptap(postContent);
	const words = text.trim().split(/\s+/).filter(word => word.length > 0);
	const wordCount = words.length;
	const minutes = Math.ceil(wordCount / WORDS_PER_MINUTE);
	return Math.max(1, minutes); // Minimum 1 minute
}

// ============================================================================
// Types
// ============================================================================

export type PublishStatus = "draft" | "published" | "archived";

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

const publishStatusSchema = z.enum(["draft", "published", "archived"]);

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
		.use(createPermissionMiddleware("blog", ["write"]))
		.input(createPostSchema)
		.mutation(async ({ ctx, input }) => {
			const db = getBlogDb(ctx.env);

			// Check if slug already exists
			const existingPost = await db
				.select({ id: blogPosts.id })
				.from(blogPosts)
				.where(eq(blogPosts.slug, input.slug))
				.limit(1);

			if (existingPost.length > 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "A post with this slug already exists",
				});
			}

			const postId = generatePostId();
			const now = new Date();

			// Set publishedAt to current time if not provided
			const publishedAt = input.publishedAt ?? now;

			// Auto-calculate reading time from post content
			const readingTimeMinutes = input.postContent
				? calculateReadingTime(input.postContent)
				: null;

			const [newPost] = await db
				.insert(blogPosts)
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
					readingTimeMinutes,
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
		.use(createPermissionMiddleware("blog", ["write"]))
		.input(updatePostSchema)
		.mutation(async ({ ctx, input }) => {
			const db = getBlogDb(ctx.env);

			// Check if post exists
			const [existingPost] = await db
				.select()
				.from(blogPosts)
				.where(eq(blogPosts.id, input.id))
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
					.select({ id: blogPosts.id })
					.from(blogPosts)
					.where(eq(blogPosts.slug, input.slug))
					.limit(1);

				if (slugExists.length > 0) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "A post with this slug already exists",
					});
				}
			}

			const updateData: Record<string, unknown> = {};

			if (input.slug !== undefined) updateData.slug = input.slug;
			if (input.title !== undefined) updateData.title = input.title;
			if (input.shortDescription !== undefined) updateData.short_description = input.shortDescription;
			if (input.postContent !== undefined) {
				updateData.postContent = input.postContent;
				// Auto-calculate reading time when content is updated
				updateData.readingTimeMinutes = calculateReadingTime(input.postContent);
			}
			if (input.featuredImageUrl !== undefined) updateData.featuredImageUrl = input.featuredImageUrl;
			if (input.featuredImageAlt !== undefined) updateData.featuredImageAlt = input.featuredImageAlt;
			if (input.publishStatus !== undefined) updateData.publishStatus = input.publishStatus;
			if (input.publishedAt !== undefined) updateData.publishedAt = input.publishedAt;
			if (input.isFeatured !== undefined) updateData.isFeatured = input.isFeatured;

			const [updatedPost] = await db
				.update(blogPosts)
				.set(updateData)
				.where(eq(blogPosts.id, input.id))
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
			? eq(blogPosts.id, input.id)
			: eq(blogPosts.slug, input.slug!);

		const [post] = await db.select().from(blogPosts).where(condition).limit(1);

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
	 * List blog posts with filtering and pagination (admin use)
	 */
	list: protectedProcedure
		.use(createPermissionMiddleware("blog", ["read"]))
		.input(listPostsSchema.optional())
		.query(async ({ ctx, input }) => {
		const db = getBlogDb(ctx.env);

		const limit = input?.limit ?? 25;
		const page = input?.page ?? 1;
		const offset = (page - 1) * limit;

		// Build where conditions
		const conditions = [];

		if (input?.status) {
			conditions.push(eq(blogPosts.publishStatus, input.status));
		}

		if (input?.featuredOnly) {
			conditions.push(eq(blogPosts.isFeatured, true));
		}

		if (input?.search) {
			const searchPattern = `%${input.search}%`;
			conditions.push(
				or(like(blogPosts.title, searchPattern), like(blogPosts.slug, searchPattern)),
			);
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Build order by
		const sortColumn = {
			createdAt: blogPosts.createdAt,
			updatedAt: blogPosts.updatedAt,
			publishedAt: blogPosts.publishedAt,
			title: blogPosts.title,
		}[input?.sortBy ?? "createdAt"];

		const sortFn = input?.sortOrder === "asc" ? asc : desc;

		// Get blogPosts
		const results = await db
			.select()
			.from(blogPosts)
			.where(whereClause)
			.orderBy(sortFn(sortColumn))
			.limit(limit)
			.offset(offset);

		// Get total count
		const [countResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(blogPosts)
			.where(whereClause);

		const total = countResult?.count ?? 0;

		return {
			blogPosts: results.map((post) => ({
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
	 * List published blog posts (public-facing) - filters for posts where publishedAt is now or older
	 */
	listFiltered: protectedProcedure
		.use(createPermissionMiddleware("blog", ["read"]))
		.input(listPostsSchema.optional())
		.query(async ({ ctx, input }) => {
			const db = getBlogDb(ctx.env);

		const limit = input?.limit ?? 25;
		const page = input?.page ?? 1;
		const offset = (page - 1) * limit;
		const now = new Date().toISOString();
		
		// Build where conditions
		const conditions = [
			eq(blogPosts.publishStatus, "published"),
			// Only include posts where publishedAt is now or in the past
			sql`${blogPosts.publishedAt} <= ${now}`,
		];

		if (input?.featuredOnly) {
			conditions.push(eq(blogPosts.isFeatured, true));
		}

		if (input?.search) {
			const searchPattern = `%${input.search}%`;
			conditions.push(
				sql`(${like(blogPosts.title, searchPattern)} OR ${like(blogPosts.slug, searchPattern)})`,
			);
		}

		const whereClause = and(...conditions);

		// Build order by
		const sortColumn = {
			createdAt: blogPosts.createdAt,
			updatedAt: blogPosts.updatedAt,
			publishedAt: blogPosts.publishedAt,
			title: blogPosts.title,
		}[input?.sortBy ?? "publishedAt"];

		const sortFn = input?.sortOrder === "asc" ? asc : desc;

		// Get posts
		const results = await db
			.select()
			.from(blogPosts)
			.where(whereClause)
			.orderBy(sortFn(sortColumn))
			.limit(limit)
			.offset(offset);

		// Get total count
		const [countResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(blogPosts)
			.where(whereClause);

		const total = countResult?.count ?? 0;

		return {
			blogPosts: results.map((post) => ({
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
		.use(createPermissionMiddleware("blog", ["delete"]))
		.input(deletePostSchema)
		.mutation(async ({ ctx, input }) => {
			const db = getBlogDb(ctx.env);

			// Check if post exists
			const [existingPost] = await db
				.select({ id: blogPosts.id })
				.from(blogPosts)
				.where(eq(blogPosts.id, input.id))
				.limit(1);

			if (!existingPost) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Post not found",
				});
			}

			// Delete post
			await db.delete(blogPosts).where(eq(blogPosts.id, input.id));

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
		.use(createPermissionMiddleware("blog", ["write"]))
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const db = getBlogDb(ctx.env);

			const [existingPost] = await db
				.select()
				.from(blogPosts)
				.where(eq(blogPosts.id, input.id))
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
				.update(blogPosts)
				.set({
					publishStatus: "published",
					publishedAt,
				})
				.where(eq(blogPosts.id, input.id))
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
		.use(createPermissionMiddleware("blog", ["write"]))
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const db = getBlogDb(ctx.env);

			const [existingPost] = await db
				.select()
				.from(blogPosts)
				.where(eq(blogPosts.id, input.id))
				.limit(1);

			if (!existingPost) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Post not found",
				});
			}

			const [updatedPost] = await db
				.update(blogPosts)
				.set({
					publishStatus: "draft",
				})
				.where(eq(blogPosts.id, input.id))
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
		.use(createPermissionMiddleware("blog", ["write"]))
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const db = getBlogDb(ctx.env);

			const [existingPost] = await db
				.select({ id: blogPosts.id, isFeatured: blogPosts.isFeatured })
				.from(blogPosts)
				.where(eq(blogPosts.id, input.id))
				.limit(1);

			if (!existingPost) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Post not found",
				});
			}

			const [updatedPost] = await db
				.update(blogPosts)
				.set({
					isFeatured: !existingPost.isFeatured,
				})
				.where(eq(blogPosts.id, input.id))
				.returning();

			return {
				id: updatedPost.id,
				isFeatured: updatedPost.isFeatured,
			};
		}),

	/**
	 * Set the featured image URL for a blog post
	 */
	setFeaturedImage: protectedProcedure
		.use(createPermissionMiddleware("blog", ["write"]))
		.input(
			z.object({
				postId: z.string(),
				featuredImageUrl: z.string().url(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getBlogDb(env);
			const { postId, featuredImageUrl } = input;

			try {
				// Verify the post exists
				const [existingPost] = await db
					.select({ id: blogPosts.id })
					.from(blogPosts)
					.where(eq(blogPosts.id, postId))
					.limit(1);

				if (!existingPost) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Post not found",
					});
				}

				// Update the post record with the new featured image URL
				const [updatedPost] = await db
					.update(blogPosts)
					.set({ featuredImageUrl })
					.where(eq(blogPosts.id, postId))
					.returning();

				return {
					success: true,
					featuredImageUrl,
					postId: updatedPost.id,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error setting featured image:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to set featured image",
				});
			}
		}),

	/**
	 * Clear the featured image URL from a blog post
	 */
	removeFeaturedImage: protectedProcedure
		.use(createPermissionMiddleware("blog", ["delete"]))
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
				// Verify the post exists
				const [existingPost] = await db
					.select({ id: blogPosts.id })
					.from(blogPosts)
					.where(eq(blogPosts.id, postId))
					.limit(1);

				if (!existingPost) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Post not found",
					});
				}

				// Clear the featured image URL in the database
				await db
					.update(blogPosts)
					.set({ featuredImageUrl: null })
					.where(eq(blogPosts.id, postId));

				return { success: true };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error clearing featured image:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to clear featured image",
				});
			}
		}),
});
