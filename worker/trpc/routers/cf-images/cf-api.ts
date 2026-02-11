import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
	t,
	protectedProcedure,
	createPermissionMiddleware,
} from "../../trpc-init";
import { images } from "@/db/content-schema";
import { generateImageId } from "@/worker/lib/generate-id";
import {
	cfImagesUrl,
	cfHeaders,
	unwrapCfResponse,
	extractDeliveryUrl,
	getContentDb,
	buildCfMetadata,
	CF_CREATOR,
	type CfImageResult,
} from "./helpers";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const listCfImagesSchema = z
	.object({
		page: z.number().int().min(1).default(1),
		perPage: z.number().int().min(10).max(10000).default(100),
	})
	.optional();

const cfImageIdSchema = z.object({
	imageId: z.string().min(1, "imageId is required"),
});

const uploadViaUrlSchema = z.object({
	url: z.url("A valid URL is required"),
	imageId: z.string().optional(),
	fileName: z.string().optional(),
	altText: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	requireSignedURLs: z.boolean().default(false),
});

const uploadFileSchema = z.object({
	/** Base-64 encoded file content */
	fileBase64: z.string().min(1, "fileBase64 is required"),
	fileName: z.string().min(1, "fileName is required"),
	altText: z.string().optional(),
	imageId: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	requireSignedURLs: z.boolean().default(false),
});

const directUploadSchema = z.object({
	metadata: z.record(z.string(), z.unknown()).optional(),
	requireSignedURLs: z.boolean().default(false),
	/** ISO-8601 datetime string for when the upload URL expires (2 min – 6 hr). */
	expiry: z.iso.datetime().optional(),
	/** Optional custom ID for the image. */
	imageId: z.string().optional(),
});

const updateCfImageSchema = z.object({
	imageId: z.string().min(1, "imageId is required"),
	metadata: z.record(z.string(), z.unknown()).optional(),
	requireSignedURLs: z.boolean().optional(),
});

const batchUploadViaUrlSchema = z.object({
	images: z
		.array(
			z.object({
				url: z.url("A valid URL is required"),
				imageId: z.string().optional(),
				fileName: z.string().optional(),
				altText: z.string().optional(),
				metadata: z.record(z.string(), z.unknown()).optional(),
				requireSignedURLs: z.boolean().default(false),
			}),
		)
		.min(1, "At least one image is required")
		.max(200, "Maximum 200 images per batch"),
});

// ---------------------------------------------------------------------------
// Router – Cloudflare Images API procedures
// ---------------------------------------------------------------------------

export const cfApiRouter = t.router({
	// -----------------------------------------------------------------------
	// LIST CF IMAGES – paginated listing from CF API
	// -----------------------------------------------------------------------
	listCfImages: protectedProcedure
		.use(createPermissionMiddleware("images", ["read"]))
		.input(listCfImagesSchema)
		.query(async ({ ctx, input }) => {
			const { env } = ctx;
			const page = input?.page ?? 1;
			const perPage = input?.perPage ?? 100;

			const url = new URL(cfImagesUrl(env.CLOUDFLARE_ACCOUNT_ID, "/v1"));
			url.searchParams.set("page", String(page));
			url.searchParams.set("per_page", String(perPage));

			try {
				const res = await fetch(url.toString(), {
					method: "GET",
					headers: cfHeaders(env.CLOUDFLARE_IMAGES_API_KEY),
				});

				return await unwrapCfResponse<{ images: CfImageResult[] }>(
					res,
					"Failed to list images from Cloudflare",
				);
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error listing CF images:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to list images from Cloudflare",
				});
			}
		}),

	// -----------------------------------------------------------------------
	// GET CF IMAGE DETAILS – single image from CF API
	// -----------------------------------------------------------------------
	getCfImageDetails: protectedProcedure
		.use(createPermissionMiddleware("images", ["read"]))
		.input(cfImageIdSchema)
		.query(async ({ ctx, input }) => {
			const { env } = ctx;

			try {
				const res = await fetch(
					cfImagesUrl(env.CLOUDFLARE_ACCOUNT_ID, `/v1/${input.imageId}`),
					{
						method: "GET",
						headers: cfHeaders(env.CLOUDFLARE_IMAGES_API_KEY),
					},
				);

				return await unwrapCfResponse<CfImageResult>(
					res,
					"Failed to get image details",
				);
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error getting CF image details:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get image details",
				});
			}
		}),

	// -----------------------------------------------------------------------
	// UPLOAD VIA URL – upload from URL → CF Images + D1
	// -----------------------------------------------------------------------
	uploadViaUrl: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.input(uploadViaUrlSchema)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getContentDb(env);

			// Generate DB ID early so it can be embedded in CF metadata
			const dbId = generateImageId();

			// 1. Upload to Cloudflare Images
			const formData = new FormData();
			formData.append("url", input.url);

			if (input.imageId) formData.append("id", input.imageId);
			formData.append("creator", CF_CREATOR);
			formData.append(
				"metadata",
				JSON.stringify(buildCfMetadata(dbId, input.metadata)),
			);
			if (input.requireSignedURLs)
				formData.append("requireSignedURLs", "true");

			let cfResult: CfImageResult;
			try {
				const res = await fetch(
					cfImagesUrl(env.CLOUDFLARE_ACCOUNT_ID, "/v1"),
					{
						method: "POST",
						headers: cfHeaders(env.CLOUDFLARE_IMAGES_API_KEY),
						body: formData,
					},
				);
				cfResult = await unwrapCfResponse<CfImageResult>(
					res,
					"Failed to upload image via URL",
				);
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error uploading image via URL:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to upload image via URL",
				});
			}

			// 2. Store record in D1
			const imageRecord = {
				id: dbId,
				cfImageId: cfResult.id,
				deliveryUrl: extractDeliveryUrl(
					cfResult.variants,
					env.CLOUDFLARE_IMAGES_DOMAIN,
				),
				fileName: input.fileName ?? cfResult.filename ?? null,
				altText: input.altText ?? null,
				width: null,
				height: null,
				requireSignedURLs: input.requireSignedURLs,
				metadata: input.metadata ?? null,
			};

			await db.insert(images).values(imageRecord);

			return { ...imageRecord, cfResult };
		}),

	// -----------------------------------------------------------------------
	// UPLOAD FILE – upload base-64 file → CF Images + D1
	// -----------------------------------------------------------------------
	uploadFile: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.input(uploadFileSchema)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getContentDb(env);

			// Generate DB ID early so it can be embedded in CF metadata
			const dbId = generateImageId();

			// Decode base-64 → bytes → File
			const raw = atob(input.fileBase64);
			const bytes = new Uint8Array(raw.length);
			for (let i = 0; i < raw.length; i++) {
				bytes[i] = raw.charCodeAt(i);
			}

			const formData = new FormData();
			formData.append("file", new File([bytes], input.fileName));

			if (input.imageId) formData.append("id", input.imageId);
			formData.append("creator", CF_CREATOR);
			formData.append(
				"metadata",
				JSON.stringify(buildCfMetadata(dbId, input.metadata)),
			);
			if (input.requireSignedURLs)
				formData.append("requireSignedURLs", "true");

			let cfResult: CfImageResult;
			try {
				const res = await fetch(
					cfImagesUrl(env.CLOUDFLARE_ACCOUNT_ID, "/v1"),
					{
						method: "POST",
						headers: cfHeaders(env.CLOUDFLARE_IMAGES_API_KEY),
						body: formData,
					},
				);
				cfResult = await unwrapCfResponse<CfImageResult>(
					res,
					"Failed to upload image file",
				);
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error uploading image file:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to upload image file",
				});
			}

			// Store record in D1
			const imageRecord = {
				id: dbId,
				cfImageId: cfResult.id,
				deliveryUrl: extractDeliveryUrl(
					cfResult.variants,
					env.CLOUDFLARE_IMAGES_DOMAIN,
				),
				fileName: input.fileName,
				altText: input.altText ?? null,
				width: null,
				height: null,
				requireSignedURLs: input.requireSignedURLs,
				metadata: input.metadata ?? null,
			};

			await db.insert(images).values(imageRecord);

			return { ...imageRecord, cfResult };
		}),

	// -----------------------------------------------------------------------
	// CREATE DIRECT UPLOAD URL – for client-side uploads
	// -----------------------------------------------------------------------
	createDirectUploadUrl: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.input(directUploadSchema.optional())
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;

			const formData = new FormData();
			if (input?.requireSignedURLs)
				formData.append("requireSignedURLs", "true");
			formData.append("creator", CF_CREATOR);
			// dbId will be added on confirmDirectUpload
			formData.append(
				"metadata",
				JSON.stringify(buildCfMetadata(undefined, input?.metadata)),
			);
			if (input?.expiry) formData.append("expiry", input.expiry);
			if (input?.imageId) formData.append("id", input.imageId);

			try {
				const res = await fetch(
					cfImagesUrl(env.CLOUDFLARE_ACCOUNT_ID, "/v2/direct_upload"),
					{
						method: "POST",
						headers: cfHeaders(env.CLOUDFLARE_IMAGES_API_KEY),
						body: formData,
					},
				);

				return await unwrapCfResponse<{ id: string; uploadURL: string }>(
					res,
					"Failed to create direct upload URL",
				);
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error creating direct upload URL:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create direct upload URL",
				});
			}
		}),

	// -----------------------------------------------------------------------
	// CONFIRM DIRECT UPLOAD – after client uploads, save to D1
	// -----------------------------------------------------------------------
	confirmDirectUpload: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.input(
			z.object({
				cfImageId: z.string().min(1, "cfImageId is required"),
				fileName: z.string().optional(),
				altText: z.string().optional(),
				width: z.number().int().optional(),
				height: z.number().int().optional(),
				metadata: z.record(z.string(), z.unknown()).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getContentDb(env);

			// Generate DB ID early so we can patch it into CF metadata
			const dbId = generateImageId();

			// Fetch image details from CF to get the delivery URL
			let cfResult: CfImageResult;
			try {
				const res = await fetch(
					cfImagesUrl(env.CLOUDFLARE_ACCOUNT_ID, `/v1/${input.cfImageId}`),
					{
						method: "GET",
						headers: cfHeaders(env.CLOUDFLARE_IMAGES_API_KEY),
					},
				);
				cfResult = await unwrapCfResponse<CfImageResult>(
					res,
					"Failed to fetch uploaded image details",
				);
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error fetching uploaded image details:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch uploaded image details",
				});
			}

			// Patch CF metadata with the dbId (direct uploads start without it)
			try {
				await fetch(
					cfImagesUrl(env.CLOUDFLARE_ACCOUNT_ID, `/v1/${input.cfImageId}`),
					{
						method: "PATCH",
						headers: {
							...cfHeaders(env.CLOUDFLARE_IMAGES_API_KEY),
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							metadata: buildCfMetadata(dbId, cfResult.meta),
						}),
					},
				);
			} catch (error) {
				console.error("Warning: Failed to patch CF metadata with dbId:", error);
			}

			const imageRecord = {
				id: dbId,
				cfImageId: cfResult.id,
				deliveryUrl: extractDeliveryUrl(
					cfResult.variants,
					env.CLOUDFLARE_IMAGES_DOMAIN,
				),
				fileName: input.fileName ?? cfResult.filename ?? null,
				altText: input.altText ?? null,
				width: input.width ?? null,
				height: input.height ?? null,
				requireSignedURLs: cfResult.requireSignedURLs,
				metadata: input.metadata ?? null,
			};

			await db.insert(images).values(imageRecord);

			return imageRecord;
		}),

	// -----------------------------------------------------------------------
	// UPDATE CF IMAGE – update metadata/access on CF API
	// -----------------------------------------------------------------------
	updateCfImage: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.input(updateCfImageSchema)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;

			const body: Record<string, unknown> = {};
			if (input.metadata !== undefined)
				body.metadata = buildCfMetadata(undefined, input.metadata);
			if (input.requireSignedURLs !== undefined)
				body.requireSignedURLs = input.requireSignedURLs;

			try {
				const res = await fetch(
					cfImagesUrl(env.CLOUDFLARE_ACCOUNT_ID, `/v1/${input.imageId}`),
					{
						method: "PATCH",
						headers: {
							...cfHeaders(env.CLOUDFLARE_IMAGES_API_KEY),
							"Content-Type": "application/json",
						},
						body: JSON.stringify(body),
					},
				);

				return await unwrapCfResponse(
					res,
					"Failed to update image on Cloudflare",
				);
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error updating CF image:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update image on Cloudflare",
				});
			}
		}),

	// -----------------------------------------------------------------------
	// DELETE CF IMAGE – remove from CF Images API (not D1)
	// -----------------------------------------------------------------------
	deleteCfImage: protectedProcedure
		.use(createPermissionMiddleware("images", ["delete"]))
		.input(cfImageIdSchema)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;

			try {
				const res = await fetch(
					cfImagesUrl(env.CLOUDFLARE_ACCOUNT_ID, `/v1/${input.imageId}`),
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
				if (error instanceof TRPCError) throw error;
				console.error("Error deleting CF image:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete image from Cloudflare",
				});
			}

			return { deleted: true, cfImageId: input.imageId };
		}),

	// -----------------------------------------------------------------------
	// STATS – CF Images usage statistics
	// -----------------------------------------------------------------------
	getStats: protectedProcedure
		.use(createPermissionMiddleware("images", ["read"]))
		.query(async ({ ctx }) => {
			const { env } = ctx;

			try {
				const res = await fetch(
					cfImagesUrl(env.CLOUDFLARE_ACCOUNT_ID, "/v1/stats"),
					{
						method: "GET",
						headers: cfHeaders(env.CLOUDFLARE_IMAGES_API_KEY),
					},
				);

				return await unwrapCfResponse<{
					count: { current: number; allowed: number };
				}>(res, "Failed to get image stats");
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error getting image stats:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get image stats",
				});
			}
		}),

	// -----------------------------------------------------------------------
	// GET BATCH TOKEN
	// -----------------------------------------------------------------------
	getBatchToken: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.mutation(async ({ ctx }) => {
			const { env } = ctx;

			try {
				const res = await fetch(
					cfImagesUrl(env.CLOUDFLARE_ACCOUNT_ID, "/v1/batch_token"),
					{
						method: "GET",
						headers: cfHeaders(env.CLOUDFLARE_IMAGES_API_KEY),
					},
				);

				return await unwrapCfResponse<{ token: string; expiresAt: string }>(
					res,
					"Failed to get batch token",
				);
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error getting batch token:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get batch token",
				});
			}
		}),

	// -----------------------------------------------------------------------
	// BATCH UPLOAD VIA URL – upload many images → CF + D1
	// -----------------------------------------------------------------------
	batchUploadViaUrl: protectedProcedure
		.use(createPermissionMiddleware("images", ["write"]))
		.input(batchUploadViaUrlSchema)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getContentDb(env);

			// 1. Obtain a batch token
			let batchToken: string;
			try {
				const tokenRes = await fetch(
					cfImagesUrl(env.CLOUDFLARE_ACCOUNT_ID, "/v1/batch_token"),
					{
						method: "GET",
						headers: cfHeaders(env.CLOUDFLARE_IMAGES_API_KEY),
					},
				);
				const tokenResult = await unwrapCfResponse<{
					token: string;
					expiresAt: string;
				}>(tokenRes, "Failed to get batch token");
				batchToken = tokenResult.token;
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error getting batch token:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get batch token for bulk upload",
				});
			}

			// 2. Upload each image using the batch endpoint + insert to D1
			const BATCH_HOST = "https://batch.imagedelivery.net";
			const results: {
				index: number;
				success: boolean;
				cfImageId?: string;
				dbId?: string;
				error?: string;
			}[] = [];

			for (let i = 0; i < input.images.length; i++) {
				const img = input.images[i];
				const dbId = generateImageId();
				const formData = new FormData();
				formData.append("url", img.url);

				if (img.imageId) formData.append("id", img.imageId);
				formData.append("creator", CF_CREATOR);
				formData.append(
					"metadata",
					JSON.stringify(buildCfMetadata(dbId, img.metadata)),
				);
				if (img.requireSignedURLs)
					formData.append("requireSignedURLs", "true");

				try {
					const res = await fetch(`${BATCH_HOST}/images/v1`, {
						method: "POST",
						headers: { Authorization: `Bearer ${batchToken}` },
						body: formData,
					});

					const json = (await res.json()) as {
						success: boolean;
						result?: CfImageResult;
						errors?: { code: number; message: string }[];
					};

					if (json.success && json.result) {
						await db.insert(images).values({
							id: dbId,
							cfImageId: json.result.id,
							deliveryUrl: extractDeliveryUrl(
								json.result.variants,
								env.CLOUDFLARE_IMAGES_DOMAIN,
							),
							fileName: img.fileName ?? json.result.filename ?? null,
							altText: img.altText ?? null,
							width: null,
							height: null,
							requireSignedURLs: img.requireSignedURLs,
							metadata: img.metadata ?? null,
						});
						results.push({
							index: i,
							success: true,
							cfImageId: json.result!.id,
							dbId,
						});
					} else {
						const detail =
							json.errors?.map((e) => e.message).join("; ") ??
							"Unknown error";
						results.push({ index: i, success: false, error: detail });
					}
				} catch (error) {
					results.push({
						index: i,
						success: false,
						error:
							error instanceof Error
								? error.message
								: "Unknown error",
					});
				}
			}

			const succeeded = results.filter((r) => r.success).length;
			const failed = results.filter((r) => !r.success).length;

			return { total: input.images.length, succeeded, failed, results };
		}),
});
