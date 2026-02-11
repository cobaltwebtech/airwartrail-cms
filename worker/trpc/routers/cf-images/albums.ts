import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, asc, count, sql } from "drizzle-orm";
import {
	t,
	protectedProcedure,
	createPermissionMiddleware,
} from "../../trpc-init";
import { albums, albumImages } from "@/db/content-schema";
import { generateAlbumId } from "@/worker/lib/generate-id";
import { getContentDb } from "./helpers";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const publishStatusSchema = z.enum(["draft", "published", "archived"]);

const createAlbumSchema = z.object({
	slug: z.string().min(1).max(255),
	title: z.string().min(1).max(255),
	description: z.string().max(1000).optional(),
	publishStatus: publishStatusSchema.default("draft"),
	coverImageId: z.string().optional(),
});

const updateAlbumSchema = z.object({
	id: z.string().min(1),
	slug: z.string().min(1).max(255).optional(),
	title: z.string().min(1).max(255).optional(),
	description: z.string().max(1000).nullable().optional(),
	publishStatus: publishStatusSchema.optional(),
	coverImageId: z.string().nullable().optional(),
});

const getAlbumSchema = z
	.object({
		id: z.string().optional(),
		slug: z.string().optional(),
	})
	.refine((data) => data.id || data.slug, {
		message: "Either id or slug must be provided",
	});

const listAlbumsSchema = z
	.object({
		limit: z.number().int().min(1).max(100).default(25),
		page: z.number().int().min(1).default(1),
		status: publishStatusSchema.optional(),
		sortBy: z
			.enum(["createdAt", "updatedAt", "title"])
			.default("createdAt"),
		sortOrder: z.enum(["asc", "desc"]).default("desc"),
	})
	.optional();

// ---------------------------------------------------------------------------
// Router – Album CRUD procedures
// ---------------------------------------------------------------------------

export const albumsRouter = t.router({
	// -----------------------------------------------------------------------
	// CREATE ALBUM
	// -----------------------------------------------------------------------
	createAlbum: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.input(createAlbumSchema)
		.mutation(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			// Check slug uniqueness
			const existing = await db
				.select({ id: albums.id })
				.from(albums)
				.where(eq(albums.slug, input.slug))
				.limit(1);

			if (existing.length > 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "An album with this slug already exists",
				});
			}

			const album = {
				id: generateAlbumId(),
				slug: input.slug,
				title: input.title,
				description: input.description ?? null,
				publishStatus: input.publishStatus as
					| "draft"
					| "published"
					| "archived",
				coverImageId: input.coverImageId ?? null,
				authorId: ctx.user.id,
				imageCount: 0,
			};

			await db.insert(albums).values(album);

			return album;
		}),

	// -----------------------------------------------------------------------
	// GET ALBUM – by ID or slug, with images
	// -----------------------------------------------------------------------
	getAlbum: protectedProcedure
		.use(createPermissionMiddleware("images", ["read"]))
		.input(getAlbumSchema)
		.query(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			const condition = input.id
				? eq(albums.id, input.id)
				: eq(albums.slug, input.slug!);

			const album = await db.query.albums.findFirst({
				where: condition,
				with: {
					coverImage: true,
					images: {
						with: { image: true },
						orderBy: [asc(albumImages.sortOrder)],
					},
				},
			});

			if (!album) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Album not found",
				});
			}

			return album;
		}),

	// -----------------------------------------------------------------------
	// LIST ALBUMS – paginated with filtering
	// -----------------------------------------------------------------------
	listAlbums: protectedProcedure
		.use(createPermissionMiddleware("images", ["read"]))
		.input(listAlbumsSchema)
		.query(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);
			const limit = input?.limit ?? 25;
			const page = input?.page ?? 1;
			const offset = (page - 1) * limit;
			const sortBy = input?.sortBy ?? "createdAt";
			const order = input?.sortOrder === "asc" ? asc : desc;

			const conditions = [];
			if (input?.status) {
				conditions.push(eq(albums.publishStatus, input.status));
			}

			const whereClause =
				conditions.length > 0 ? and(...conditions) : undefined;

			const sortColumn =
				sortBy === "title"
					? albums.title
					: sortBy === "updatedAt"
						? albums.updatedAt
						: albums.createdAt;

			const [items, totalResult] = await Promise.all([
				db.query.albums.findMany({
					where: whereClause,
					with: { coverImage: true },
					orderBy: [order(sortColumn)],
					limit,
					offset,
				}),
				db
					.select({ total: count() })
					.from(albums)
					.where(whereClause),
			]);

			const total = totalResult[0]?.total ?? 0;

			return {
				albums: items,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			};
		}),

	// -----------------------------------------------------------------------
	// UPDATE ALBUM
	// -----------------------------------------------------------------------
	updateAlbum: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.input(updateAlbumSchema)
		.mutation(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);
			const { id, ...updates } = input;

			// Check slug uniqueness if being changed
			if (updates.slug) {
				const existing = await db
					.select({ id: albums.id })
					.from(albums)
					.where(
						and(
							eq(albums.slug, updates.slug),
							sql`${albums.id} != ${id}`,
						),
					)
					.limit(1);

				if (existing.length > 0) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "An album with this slug already exists",
					});
				}
			}

			const setValues: Record<string, unknown> = {};
			if (updates.slug !== undefined) setValues.slug = updates.slug;
			if (updates.title !== undefined) setValues.title = updates.title;
			if (updates.description !== undefined)
				setValues.description = updates.description;
			if (updates.publishStatus !== undefined)
				setValues.publishStatus = updates.publishStatus;
			if (updates.coverImageId !== undefined)
				setValues.coverImageId = updates.coverImageId;

			if (Object.keys(setValues).length === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "No fields to update",
				});
			}

			const result = await db
				.update(albums)
				.set(setValues)
				.where(eq(albums.id, id))
				.returning();

			if (result.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Album not found",
				});
			}

			return result[0];
		}),

	// -----------------------------------------------------------------------
	// DELETE ALBUM
	// -----------------------------------------------------------------------
	deleteAlbum: protectedProcedure
		.use(createPermissionMiddleware("images", ["delete"]))
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			const result = await db
				.delete(albums)
				.where(eq(albums.id, input.id))
				.returning({ id: albums.id });

			if (result.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Album not found",
				});
			}

			return { deleted: true, id: input.id };
		}),

	// -----------------------------------------------------------------------
	// PUBLISH / UNPUBLISH / ARCHIVE helpers
	// -----------------------------------------------------------------------
	publishAlbum: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			const result = await db
				.update(albums)
				.set({ publishStatus: "published" })
				.where(eq(albums.id, input.id))
				.returning();

			if (result.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Album not found",
				});
			}

			return result[0];
		}),

	unpublishAlbum: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			const result = await db
				.update(albums)
				.set({ publishStatus: "draft" })
				.where(eq(albums.id, input.id))
				.returning();

			if (result.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Album not found",
				});
			}

			return result[0];
		}),

	archiveAlbum: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			const result = await db
				.update(albums)
				.set({ publishStatus: "archived" })
				.where(eq(albums.id, input.id))
				.returning();

			if (result.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Album not found",
				});
			}

			return result[0];
		}),
});
