import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
	t,
	protectedProcedure,
	createPermissionMiddleware,
} from "../../trpc-init";
import { albums, albumImages } from "@/db/content-schema";
import { generateAlbumImageId } from "@/worker/lib/generate-id";
import { getContentDb } from "./helpers";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const addImageToAlbumSchema = z.object({
	albumId: z.string().min(1),
	imageId: z.string().min(1),
	caption: z.string().optional(),
	sortOrder: z.number().int().optional(),
});

const addImagesToAlbumSchema = z.object({
	albumId: z.string().min(1),
	imageIds: z.array(z.string().min(1)).min(1).max(200),
});

const removeImageFromAlbumSchema = z.object({
	albumId: z.string().min(1),
	imageId: z.string().min(1),
});

const reorderAlbumImagesSchema = z.object({
	albumId: z.string().min(1),
	/** Array of image IDs in the desired sort order */
	imageIds: z.array(z.string().min(1)).min(1),
});

const updateAlbumImageSchema = z.object({
	albumId: z.string().min(1),
	imageId: z.string().min(1),
	caption: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Update the denormalized imageCount on an album. */
async function refreshAlbumImageCount(
	db: ReturnType<typeof getContentDb>,
	albumId: string,
) {
	await db
		.update(albums)
		.set({
			imageCount: sql`(SELECT COUNT(*) FROM album_images WHERE album_id = ${albumId})`,
		})
		.where(eq(albums.id, albumId));
}

// ---------------------------------------------------------------------------
// Router – Album ↔ Image junction procedures
// ---------------------------------------------------------------------------

export const albumImagesRouter = t.router({
	// -----------------------------------------------------------------------
	// ADD IMAGE TO ALBUM
	// -----------------------------------------------------------------------
	addImageToAlbum: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.input(addImageToAlbumSchema)
		.mutation(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			// Determine sortOrder: use provided or append to end
			let sortOrder = input.sortOrder;
			if (sortOrder === undefined) {
				const maxResult = await db
					.select({
						maxSort: sql<number>`COALESCE(MAX(${albumImages.sortOrder}), -1)`,
					})
					.from(albumImages)
					.where(eq(albumImages.albumId, input.albumId));
				sortOrder = (maxResult[0]?.maxSort ?? -1) + 1;
			}

			const record = {
				id: generateAlbumImageId(),
				albumId: input.albumId,
				imageId: input.imageId,
				caption: input.caption ?? null,
				sortOrder,
			};

			try {
				await db.insert(albumImages).values(record);
			} catch (error) {
				if (
					error instanceof Error &&
					error.message.includes("UNIQUE constraint failed")
				) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "This image is already in the album",
					});
				}
				throw error;
			}

			await refreshAlbumImageCount(db, input.albumId);

			return record;
		}),

	// -----------------------------------------------------------------------
	// ADD MULTIPLE IMAGES TO ALBUM
	// -----------------------------------------------------------------------
	addImagesToAlbum: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.input(addImagesToAlbumSchema)
		.mutation(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			// Get current max sort order
			const maxResult = await db
				.select({
					maxSort: sql<number>`COALESCE(MAX(${albumImages.sortOrder}), -1)`,
				})
				.from(albumImages)
				.where(eq(albumImages.albumId, input.albumId));
			let nextSort = (maxResult[0]?.maxSort ?? -1) + 1;

			const records = input.imageIds.map((imageId) => ({
				id: generateAlbumImageId(),
				albumId: input.albumId,
				imageId,
				caption: null,
				sortOrder: nextSort++,
			}));

			// Batch insert, skipping duplicates with onConflictDoNothing
			const inserted = await db
				.insert(albumImages)
				.values(records)
				.onConflictDoNothing({
					target: [albumImages.albumId, albumImages.imageId],
				})
				.returning({ id: albumImages.id });

			const added = inserted.length;

			await refreshAlbumImageCount(db, input.albumId);

			return {
				albumId: input.albumId,
				added,
				total: input.imageIds.length,
			};
		}),

	// -----------------------------------------------------------------------
	// REMOVE IMAGE FROM ALBUM
	// -----------------------------------------------------------------------
	removeImageFromAlbum: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.input(removeImageFromAlbumSchema)
		.mutation(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			const result = await db
				.delete(albumImages)
				.where(
					and(
						eq(albumImages.albumId, input.albumId),
						eq(albumImages.imageId, input.imageId),
					),
				)
				.returning({ id: albumImages.id });

			if (result.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Image not found in this album",
				});
			}

			await refreshAlbumImageCount(db, input.albumId);

			return {
				removed: true,
				albumId: input.albumId,
				imageId: input.imageId,
			};
		}),

	// -----------------------------------------------------------------------
	// REORDER ALBUM IMAGES
	// -----------------------------------------------------------------------
	reorderAlbumImages: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.input(reorderAlbumImagesSchema)
		.mutation(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			// Build SQL CASE statement for batch update in single query
			// UPDATE album_images SET sort_order = CASE image_id WHEN 'id1' THEN 0 WHEN 'id2' THEN 1 ... END
			const caseStatements = input.imageIds
				.map((imageId, idx) => sql`WHEN ${imageId} THEN ${idx}`)
				.reduce((acc, curr) => sql`${acc} ${curr}`);

			await db
				.update(albumImages)
				.set({
					sortOrder: sql`CASE ${albumImages.imageId} ${caseStatements} END`,
				})
				.where(
					and(
						eq(albumImages.albumId, input.albumId),
						inArray(albumImages.imageId, input.imageIds),
					),
				);

			return { reordered: true, albumId: input.albumId };
		}),

	// -----------------------------------------------------------------------
	// UPDATE ALBUM IMAGE – update caption on a junction record
	// -----------------------------------------------------------------------
	updateAlbumImage: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.input(updateAlbumImageSchema)
		.mutation(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			const setValues: Record<string, unknown> = {};
			if (input.caption !== undefined) setValues.caption = input.caption;

			if (Object.keys(setValues).length === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "No fields to update",
				});
			}

			const result = await db
				.update(albumImages)
				.set(setValues)
				.where(
					and(
						eq(albumImages.albumId, input.albumId),
						eq(albumImages.imageId, input.imageId),
					),
				)
				.returning();

			if (result.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Image not found in this album",
				});
			}

			return result[0];
		}),

	// -----------------------------------------------------------------------
	// SET COVER IMAGE – convenience shortcut
	// -----------------------------------------------------------------------
	setCoverImage: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.input(
			z.object({
				albumId: z.string().min(1),
				imageId: z.string().min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			const result = await db
				.update(albums)
				.set({ coverImageId: input.imageId })
				.where(eq(albums.id, input.albumId))
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
