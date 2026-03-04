import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, asc, sql, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { t, protectedProcedure, publicProcedure, createPermissionMiddleware } from "../../trpc-init";
import { pages } from "@/db/content-schema";
import { customAlphabet } from "nanoid";

// ============================================================================
// Database Helper
// ============================================================================

export function getPagesDb(env: Env) {
	return drizzle(env.DB_CONTENT);
}

// ============================================================================
// ID Generation
// ============================================================================

export const generatePageId = customAlphabet(
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
	16,
);

// ============================================================================
// Types
// ============================================================================

export type PagePublishStatus = "published" | "unpublished";

export interface Page {
	id: string;
	slug: string;
	title: string;
	pageContent: unknown;
	publishStatus: PagePublishStatus;
	publishedAt: Date | null;
	author: string;
	authorId: string | null;
	createdAt: Date;
	updatedAt: Date;
}

// ============================================================================
// Schemas
// ============================================================================

const publishStatusSchema = z.enum(["published", "unpublished"]);

const pageContentSchema = z.unknown();

const createPageSchema = z.object({
	slug: z.string().min(1).max(255),
	title: z.string().min(1).max(255),
	pageContent: pageContentSchema.optional(),
	publishStatus: publishStatusSchema.default("unpublished"),
	publishedAt: z.date().optional(),
});

const updatePageSchema = z.object({
	id: z.string(),
	slug: z.string().min(1).max(255).optional(),
	title: z.string().min(1).max(255).optional(),
	pageContent: pageContentSchema.optional(),
	publishStatus: publishStatusSchema.optional(),
	publishedAt: z.date().nullable().optional(),
});

const getPageSchema = z.object({
	id: z.string().optional(),
	slug: z.string().optional(),
}).refine((data) => data.id || data.slug, {
	message: "Either id or slug must be provided",
});

const listPagesSchema = z.object({
	limit: z.number().min(1).max(100).default(25),
	page: z.number().min(1).default(1),
	status: publishStatusSchema.optional(),
	search: z.string().optional(),
	sortBy: z.enum(["createdAt", "updatedAt", "publishedAt", "title"]).default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const deletePageSchema = z.object({
	id: z.string(),
});


// ============================================================================
// Pages Router
// ============================================================================

export const pagesRouter = t.router({
	/**
	 * Create a new page
	 */
	create: protectedProcedure
		.use(createPermissionMiddleware("content", ["write"]))
		.input(createPageSchema)
		.mutation(async ({ ctx, input }) => {
			const db = getPagesDb(ctx.env);

			// Check if slug already exists
			const existingPage = await db
				.select({ id: pages.id })
				.from(pages)
				.where(eq(pages.slug, input.slug))
				.limit(1);

			if (existingPage.length > 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "A page with this slug already exists",
				});
			}

			const pageId = generatePageId();
			const now = new Date();

			const publishedAt = input.publishedAt ?? now;

			const [newPage] = await db
				.insert(pages)
				.values({
					id: pageId,
					slug: input.slug,
					title: input.title,
					pageContent: input.pageContent ?? null,
					publishStatus: input.publishStatus,
					publishedAt,
					author: ctx.user.name,
					authorId: ctx.user.id,
				})
				.returning();

			return {
				id: newPage.id,
				slug: newPage.slug,
				title: newPage.title,
				pageContent: newPage.pageContent,
				publishStatus: newPage.publishStatus as PagePublishStatus,
				publishedAt: newPage.publishedAt,
				author: newPage.author,
				authorId: newPage.authorId,
				createdAt: newPage.createdAt,
				updatedAt: newPage.updatedAt,
			};
		}),

	/**
	 * Update an existing page
	 */
	update: protectedProcedure
		.use(createPermissionMiddleware("content", ["write"]))
		.input(updatePageSchema)
		.mutation(async ({ ctx, input }) => {
			const db = getPagesDb(ctx.env);

			const [existingPage] = await db
				.select()
				.from(pages)
				.where(eq(pages.id, input.id))
				.limit(1);

			if (!existingPage) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Page not found",
				});
			}

			if (input.slug && input.slug !== existingPage.slug) {
				const slugExists = await db
					.select({ id: pages.id })
					.from(pages)
					.where(eq(pages.slug, input.slug))
					.limit(1);

				if (slugExists.length > 0) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "A page with this slug already exists",
					});
				}
			}

			const updateData: Record<string, unknown> = {};

			if (input.slug !== undefined) updateData.slug = input.slug;
			if (input.title !== undefined) updateData.title = input.title;
			if (input.pageContent !== undefined) updateData.pageContent = input.pageContent;
			if (input.publishStatus !== undefined) updateData.publishStatus = input.publishStatus;
			if (input.publishedAt !== undefined) updateData.publishedAt = input.publishedAt;

			const [updatedPage] = await db
				.update(pages)
				.set(updateData)
				.where(eq(pages.id, input.id))
				.returning();

			return {
				id: updatedPage.id,
				slug: updatedPage.slug,
				title: updatedPage.title,
				pageContent: updatedPage.pageContent,
				publishStatus: updatedPage.publishStatus as PagePublishStatus,
				publishedAt: updatedPage.publishedAt,
				author: updatedPage.author,
				authorId: updatedPage.authorId,
				createdAt: updatedPage.createdAt,
				updatedAt: updatedPage.updatedAt,
			};
		}),

	/**
	 * Get a single page by ID or slug
	 */
	get: publicProcedure.input(getPageSchema).query(async ({ ctx, input }) => {
		const db = getPagesDb(ctx.env);

		const condition = input.id
			? eq(pages.id, input.id)
			: eq(pages.slug, input.slug!);

		const [page] = await db.select().from(pages).where(condition).limit(1);

		if (!page) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Page not found",
			});
		}

		return {
			id: page.id,
			slug: page.slug,
			title: page.title,
			pageContent: page.pageContent,
			publishStatus: page.publishStatus as PagePublishStatus,
			publishedAt: page.publishedAt,
			author: page.author,
			authorId: page.authorId,
			createdAt: page.createdAt,
			updatedAt: page.updatedAt,
		};
	}),

	/**
	 * List pages with filtering and pagination (CMS use)
	 */
	list: protectedProcedure
		.use(createPermissionMiddleware("content", ["read"]))
		.input(listPagesSchema.optional())
		.query(async ({ ctx, input }) => {
		const db = getPagesDb(ctx.env);

		const limit = input?.limit ?? 25;
		const page = input?.page ?? 1;
		const offset = (page - 1) * limit;

		const conditions = [];

		if (input?.status) {
			conditions.push(eq(pages.publishStatus, input.status));
		}

		if (input?.search) {
			const searchPattern = `%${input.search}%`;
			conditions.push(
				or(like(pages.title, searchPattern), like(pages.slug, searchPattern)),
			);
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const sortColumn = {
			createdAt: pages.createdAt,
			updatedAt: pages.updatedAt,
			publishedAt: pages.publishedAt,
			title: pages.title,
		}[input?.sortBy ?? "createdAt"];

		const sortFn = input?.sortOrder === "asc" ? asc : desc;

		const results = await db
			.select()
			.from(pages)
			.where(whereClause)
			.orderBy(sortFn(sortColumn))
			.limit(limit)
			.offset(offset);

		const [countResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(pages)
			.where(whereClause);

		const total = countResult?.count ?? 0;

		return {
			pages: results.map((page) => ({
				id: page.id,
				slug: page.slug,
				title: page.title,
				pageContent: page.pageContent,
				publishStatus: page.publishStatus as PagePublishStatus,
				publishedAt: page.publishedAt,
				author: page.author,
				authorId: page.authorId,
				createdAt: page.createdAt,
				updatedAt: page.updatedAt,
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
	 * List published pages (public-facing)
	 */
	listPublished: publicProcedure
		.input(listPagesSchema.optional())
		.query(async ({ ctx, input }) => {
			const db = getPagesDb(ctx.env);

			const limit = input?.limit ?? 25;
			const page = input?.page ?? 1;
			const offset = (page - 1) * limit;

			const conditions = [
				eq(pages.publishStatus, "published"),
			];

			if (input?.search) {
				const searchPattern = `%${input.search}%`;
				conditions.push(
					sql`(${like(pages.title, searchPattern)} OR ${like(pages.slug, searchPattern)})`,
				);
			}

			const whereClause = and(...conditions);

			const sortColumn = {
				createdAt: pages.createdAt,
				updatedAt: pages.updatedAt,
				publishedAt: pages.publishedAt,
				title: pages.title,
			}[input?.sortBy ?? "createdAt"];

			const sortFn = input?.sortOrder === "asc" ? asc : desc;

			const results = await db
				.select({
					id: pages.id,
					slug: pages.slug,
					title: pages.title,
					pageContent: pages.pageContent,
					publishedAt: pages.publishedAt,
				})
				.from(pages)
				.where(whereClause)
				.orderBy(sortFn(sortColumn))
				.limit(limit)
				.offset(offset);

			const [countResult] = await db
				.select({ count: sql<number>`count(*)` })
				.from(pages)
				.where(whereClause);

			const total = countResult?.count ?? 0;

			return {
				pages: results,
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
	 * Delete a page
	 */
	delete: protectedProcedure
		.use(createPermissionMiddleware("content", ["delete"]))
		.input(deletePageSchema)
		.mutation(async ({ ctx, input }) => {
			const db = getPagesDb(ctx.env);

			const [existingPage] = await db
				.select({ id: pages.id })
				.from(pages)
				.where(eq(pages.id, input.id))
				.limit(1);

			if (!existingPage) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Page not found",
				});
			}

			await db.delete(pages).where(eq(pages.id, input.id));

			return {
				success: true,
				message: "Page deleted",
				id: input.id,
			};
		}),

	/**
	 * Publish a page
	 */
	publish: protectedProcedure
		.use(createPermissionMiddleware("content", ["write"]))
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const db = getPagesDb(ctx.env);

			const [existingPage] = await db
				.select()
				.from(pages)
				.where(eq(pages.id, input.id))
				.limit(1);

			if (!existingPage) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Page not found",
				});
			}

			const now = new Date();
			const publishedAt = existingPage.publishedAt ?? now;

			const [updatedPage] = await db
				.update(pages)
				.set({
					publishStatus: "published",
					publishedAt,
				})
				.where(eq(pages.id, input.id))
				.returning();

			return {
				id: updatedPage.id,
				slug: updatedPage.slug,
				title: updatedPage.title,
				publishStatus: updatedPage.publishStatus as PagePublishStatus,
				publishedAt: updatedPage.publishedAt,
			};
		}),

	/**
	 * Unpublish a page
	 */
	unpublish: protectedProcedure
		.use(createPermissionMiddleware("content", ["write"]))
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const db = getPagesDb(ctx.env);

			const [existingPage] = await db
				.select()
				.from(pages)
				.where(eq(pages.id, input.id))
				.limit(1);

			if (!existingPage) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Page not found",
				});
			}

			const [updatedPage] = await db
				.update(pages)
				.set({
					publishStatus: "unpublished",
				})
				.where(eq(pages.id, input.id))
				.returning();

			return {
				id: updatedPage.id,
				slug: updatedPage.slug,
				title: updatedPage.title,
				publishStatus: updatedPage.publishStatus as PagePublishStatus,
				publishedAt: updatedPage.publishedAt,
			};
		}),
});
