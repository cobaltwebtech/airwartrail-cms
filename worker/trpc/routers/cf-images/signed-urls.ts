import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import {
	t,
	protectedProcedure,
	createPermissionMiddleware,
} from "../../trpc-init";
import { images } from "@/db/content-schema";
import {
	getContentDb,
	generateSignedUrl,
	generateSignedUrls,
	DEFAULT_SIGNED_URL_EXPIRATION,
} from "./helpers";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const signSingleSchema = z.object({
	/** Internal DB image ID */
	imageId: z.string().min(1),
	/** Named variant (e.g. "public", "thumbnail", "mobile") */
	variant: z.string().min(1).default("public"),
	/** Expiration in seconds (default: 1 hour, max: 24 hours) */
	expirationSeconds: z
		.number()
		.int()
		.min(60)
		.max(86_400)
		.default(DEFAULT_SIGNED_URL_EXPIRATION),
});

const signMultipleVariantsSchema = z.object({
	/** Internal DB image ID */
	imageId: z.string().min(1),
	/** Named variants for srcset (e.g. ["thumbnail", "mobile", "tablet", "desktop"]) */
	variants: z.array(z.string().min(1)).min(1).max(20),
	/** Expiration in seconds (default: 1 hour, max: 24 hours) */
	expirationSeconds: z
		.number()
		.int()
		.min(60)
		.max(86_400)
		.default(DEFAULT_SIGNED_URL_EXPIRATION),
});

const signBatchSchema = z.object({
	/** Array of image IDs to sign */
	imageIds: z.array(z.string().min(1)).min(1).max(100),
	/** Named variant to sign for each image */
	variant: z.string().min(1).default("public"),
	/** Expiration in seconds (default: 1 hour, max: 24 hours) */
	expirationSeconds: z
		.number()
		.int()
		.min(60)
		.max(86_400)
		.default(DEFAULT_SIGNED_URL_EXPIRATION),
});

// ---------------------------------------------------------------------------
// Router – Signed URL procedures
// ---------------------------------------------------------------------------

export const signedUrlsRouter = t.router({
	// -----------------------------------------------------------------------
	// SIGN SINGLE – generate a signed URL for one image + variant
	// -----------------------------------------------------------------------
	signUrl: protectedProcedure
		.use(createPermissionMiddleware("images", ["read"]))
		.input(signSingleSchema)
		.query(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			const image = await db
				.select({ id: images.id, deliveryUrl: images.deliveryUrl, requireSignedURLs: images.requireSignedURLs })
				.from(images)
				.where(eq(images.id, input.imageId))
				.limit(1);

			if (image.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Image not found",
				});
			}

			const record = image[0];

			// If the image doesn't require signed URLs, return the plain variant URL
			if (!record.requireSignedURLs) {
				return {
					imageId: record.id,
					variant: input.variant,
					url: `${record.deliveryUrl}/${input.variant}`,
					signed: false,
				};
			}

			const url = await generateSignedUrl(
				record.deliveryUrl,
				input.variant,
				ctx.env.CLOUDFLARE_IMAGES_SIGNING_KEY,
				input.expirationSeconds,
			);

			return {
				imageId: record.id,
				variant: input.variant,
				url,
				signed: true,
			};
		}),

	// -----------------------------------------------------------------------
	// SIGN MULTIPLE VARIANTS – generate signed URLs for srcset usage
	// -----------------------------------------------------------------------
	signVariants: protectedProcedure
		.use(createPermissionMiddleware("images", ["read"]))
		.input(signMultipleVariantsSchema)
		.query(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			const image = await db
				.select({ id: images.id, deliveryUrl: images.deliveryUrl, requireSignedURLs: images.requireSignedURLs })
				.from(images)
				.where(eq(images.id, input.imageId))
				.limit(1);

			if (image.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Image not found",
				});
			}

			const record = image[0];

			// If the image doesn't require signed URLs, return plain variant URLs
			if (!record.requireSignedURLs) {
				return {
					imageId: record.id,
					signed: false,
					variants: input.variants.map((variant) => ({
						variant,
						url: `${record.deliveryUrl}/${variant}`,
					})),
				};
			}

			const variants = await generateSignedUrls(
				record.deliveryUrl,
				input.variants,
				ctx.env.CLOUDFLARE_IMAGES_SIGNING_KEY,
				input.expirationSeconds,
			);

			return {
				imageId: record.id,
				signed: true,
				variants,
			};
		}),

	// -----------------------------------------------------------------------
	// SIGN BATCH – generate a signed URL for many images (same variant)
	// -----------------------------------------------------------------------
	signBatch: protectedProcedure
		.use(createPermissionMiddleware("images", ["read"]))
		.input(signBatchSchema)
		.query(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			// Use inArray for efficient filtering at DB level
			// For very large arrays (>100), D1 handles this well within our schema limit
			const matched = await db
				.select({ id: images.id, deliveryUrl: images.deliveryUrl, requireSignedURLs: images.requireSignedURLs })
				.from(images)
				.where(inArray(images.id, input.imageIds));

			const results = await Promise.all(
				matched.map(async (record) => {
					if (!record.requireSignedURLs) {
						return {
							imageId: record.id,
							variant: input.variant,
							url: `${record.deliveryUrl}/${input.variant}`,
							signed: false,
						};
					}

					const url = await generateSignedUrl(
						record.deliveryUrl,
						input.variant,
						ctx.env.CLOUDFLARE_IMAGES_SIGNING_KEY,
						input.expirationSeconds,
					);

					return {
						imageId: record.id,
						variant: input.variant,
						url,
						signed: true,
					};
				}),
			);

			// Report any IDs that weren't found
			const foundIds = new Set(matched.map((r) => r.id));
			const notFound = input.imageIds.filter((id) => !foundIds.has(id));

			return { images: results, notFound };
		}),
});
