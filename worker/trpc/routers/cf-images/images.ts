import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, asc, count, inArray } from "drizzle-orm";
import {
	t,
	protectedProcedure,
	createPermissionMiddleware,
} from "../../trpc-init";
import { images } from "@/db/content-schema";
import {
	cfImagesUrl,
	cfHeaders,
	unwrapCfResponse,
	getContentDb,
	type CfImageResult,
} from "./helpers";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const listDbImagesSchema = z
	.object({
		limit: z.number().int().min(1).max(100).default(50),
		page: z.number().int().min(1).default(1),
		sortOrder: z.enum(["asc", "desc"]).default("desc"),
	})
	.optional();

const updateDbImageSchema = z.object({
	id: z.string().min(1),
	altText: z.string().nullable().optional(),
	fileName: z.string().nullable().optional(),
	width: z.number().int().nullable().optional(),
	height: z.number().int().nullable().optional(),
	requireSignedURLs: z.boolean().optional(),
	metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

// ---------------------------------------------------------------------------
// Router – D1 image record procedures
// ---------------------------------------------------------------------------

export const imagesDbRouter = t.router({
	// -----------------------------------------------------------------------
	// LIST – paginated listing from D1
	// -----------------------------------------------------------------------
	listImages: protectedProcedure
		.use(createPermissionMiddleware("images", ["read"]))
		.input(listDbImagesSchema)
		.query(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);
			const limit = input?.limit ?? 50;
			const page = input?.page ?? 1;
			const offset = (page - 1) * limit;
			const order = input?.sortOrder === "asc" ? asc : desc;

			const [items, totalResult] = await Promise.all([
				db
					.select()
					.from(images)
					.orderBy(order(images.createdAt))
					.limit(limit)
					.offset(offset),
				db.select({ total: count() }).from(images),
			]);

			const total = totalResult[0]?.total ?? 0;

			return {
				images: items,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			};
		}),

	// -----------------------------------------------------------------------
	// GET – single image from D1 by internal ID
	// -----------------------------------------------------------------------
	getImage: protectedProcedure
		.use(createPermissionMiddleware("images", ["read"]))
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			const image = await db
				.select()
				.from(images)
				.where(eq(images.id, input.id))
				.limit(1);

			if (image.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Image not found",
				});
			}

			return image[0];
		}),

	// -----------------------------------------------------------------------
	// GET BY CF IMAGE ID – find D1 record by CF image ID
	// -----------------------------------------------------------------------
	getImageByCfId: protectedProcedure
		.use(createPermissionMiddleware("images", ["read"]))
		.input(z.object({ cfImageId: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			const image = await db
				.select()
				.from(images)
				.where(eq(images.cfImageId, input.cfImageId))
				.limit(1);

			if (image.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Image not found",
				});
			}

			return image[0];
		}),

	// -----------------------------------------------------------------------
	// GET BY CF IMAGE IDS – batch query multiple images by CF image IDs
	// -----------------------------------------------------------------------
	getImagesByCfIds: protectedProcedure
		.use(createPermissionMiddleware("images", ["read"]))
		.input(z.object({ cfImageIds: z.array(z.string().min(1)).min(1) }))
		.query(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			const results = await db
				.select()
				.from(images)
				.where(inArray(images.cfImageId, input.cfImageIds));

			return results;
		}),

	// -----------------------------------------------------------------------
	// UPDATE – update local metadata in D1
	// -----------------------------------------------------------------------
	updateImage: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.input(updateDbImageSchema)
		.mutation(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);
			const { id, ...updates } = input;

			const setValues: Record<string, unknown> = {};
			if (updates.altText !== undefined) setValues.altText = updates.altText;
			if (updates.fileName !== undefined)
				setValues.fileName = updates.fileName;
			if (updates.width !== undefined) setValues.width = updates.width;
			if (updates.height !== undefined) setValues.height = updates.height;
			if (updates.requireSignedURLs !== undefined)
				setValues.requireSignedURLs = updates.requireSignedURLs;
			if (updates.metadata !== undefined)
				setValues.metadata = updates.metadata;

			if (Object.keys(setValues).length === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "No fields to update",
				});
			}

			const result = await db
				.update(images)
				.set(setValues)
				.where(eq(images.id, id))
				.returning();

			if (result.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Image not found",
				});
			}

			// Sync requireSignedURLs to Cloudflare Images API if changed
			if (updates.requireSignedURLs !== undefined) {
				try {
					const res = await fetch(
						cfImagesUrl(
							ctx.env.CLOUDFLARE_ACCOUNT_ID,
							`/v1/${result[0].cfImageId}`,
						),
						{
							method: "PATCH",
							headers: {
								...cfHeaders(ctx.env.CLOUDFLARE_IMAGES_API_KEY),
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								requireSignedURLs: updates.requireSignedURLs,
							}),
						},
					);
					await unwrapCfResponse<CfImageResult>(
						res,
						"Failed to sync requireSignedURLs to Cloudflare",
					);
				} catch (error) {
					console.error(
						"Warning: Failed to sync requireSignedURLs to CF:",
						error,
					);
				}
			}

			return result[0];
		}),

	// -----------------------------------------------------------------------
	// DELETE – remove from D1 + optionally from CF
	// -----------------------------------------------------------------------
	deleteImage: protectedProcedure
		.use(createPermissionMiddleware("images", ["delete"]))
		.input(
			z.object({
				id: z.string().min(1),
				/** Also delete from Cloudflare Images (default: true) */
				deleteFromCf: z.boolean().default(true),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getContentDb(env);

			// Get the image record to find the CF image ID
			const imageRecord = await db
				.select()
				.from(images)
				.where(eq(images.id, input.id))
				.limit(1);

			if (imageRecord.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Image not found",
				});
			}

			// Delete from Cloudflare Images if requested
			if (input.deleteFromCf) {
				try {
					const res = await fetch(
						cfImagesUrl(
							env.CLOUDFLARE_ACCOUNT_ID,
							`/v1/${imageRecord[0].cfImageId}`,
						),
						{
							method: "DELETE",
							headers: cfHeaders(env.CLOUDFLARE_IMAGES_API_KEY),
						},
					);
					await unwrapCfResponse(
						res,
						"Failed to delete image from Cloudflare",
					);
				} catch (error) {
					// Log but don't block – still remove from D1
					console.error(
						"Warning: Failed to delete from CF Images:",
						error,
					);
				}
			}

			// Delete from D1 (cascade removes album_images)
			await db.delete(images).where(eq(images.id, input.id));

			return { deleted: true, id: input.id };
		}),
});
