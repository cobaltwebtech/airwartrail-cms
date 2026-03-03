import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, asc, count, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { t, protectedProcedure, publicProcedure, createPermissionMiddleware } from "../../trpc-init";
import { documents } from "@/db/content-schema";
import { customAlphabet } from "nanoid";

// ============================================================================
// Constants
// ============================================================================

const DOCUMENT_PREFIX = "documents";
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const ALLOWED_MIME_TYPES = [
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"text/plain",
	"text/markdown",
	"application/rtf",
	"text/csv",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

const ALLOWED_EXTENSIONS = [
	"pdf",
	"doc",
	"docx",
	"txt",
	"md",
	"markdown",
	"rtf",
	"csv",
	"xls",
	"xlsx",
	"ppt",
	"pptx",
] as const;

// ============================================================================
// Database Helper
// ============================================================================

function getContentDb(env: Env) {
	return drizzle(env.DB_CONTENT);
}

// ============================================================================
// ID Generation
// ============================================================================

const generateDocumentId = customAlphabet(
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
	16,
);

// ============================================================================
// Helper Functions
// ============================================================================

function slugifyFileName(fileName: string): string {
	return fileName
		.toLowerCase()
		.trim()
		.replace(/[^\w\-.]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^\-+|\-+$/g, '');
}

function parseFileName(fileName: string): { baseName: string; ext: string } {
	const lastDot = fileName.lastIndexOf(".");
	if (lastDot === -1) {
		return { baseName: fileName, ext: "" };
	}
	return {
		baseName: fileName.slice(0, lastDot),
		ext: fileName.slice(lastDot + 1).toLowerCase(),
	};
}

async function generateUniqueDocumentKey(
	r2Bucket: R2Bucket,
	fileName: string,
): Promise<string> {
	const slugifiedFileName = slugifyFileName(fileName);
	const { baseName, ext } = parseFileName(slugifiedFileName);
	const baseKey = ext
		? `${DOCUMENT_PREFIX}/${slugifiedFileName}`
		: `${DOCUMENT_PREFIX}/${slugifiedFileName}`;

	const existingObject = await r2Bucket.head(baseKey);
	if (!existingObject) {
		return baseKey;
	}

	let suffix = 1;
	while (suffix < 1000) {
		const newFileName = ext
			? `${baseName}-${suffix}.${ext}`
			: `${baseName}-${suffix}`;
		const newKey = `${DOCUMENT_PREFIX}/${newFileName}`;

		const exists = await r2Bucket.head(newKey);
		if (!exists) {
			return newKey;
		}
		suffix++;
	}

	const timestamp = Date.now();
	const fallbackFileName = ext
		? `${baseName}-${timestamp}.${ext}`
		: `${baseName}-${timestamp}`;
	return `${DOCUMENT_PREFIX}/${fallbackFileName}`;
}

function getKeyFromUrl(url: string): string | null {
	try {
		const urlObj = new URL(url);
		return urlObj.pathname.slice(1);
	} catch {
		if (url.startsWith(DOCUMENT_PREFIX)) {
			return url;
		}
		return null;
	}
}

function validateFileExtension(fileName: string): boolean {
	const { ext } = parseFileName(fileName);
	return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

// ============================================================================
// Zod Schemas
// ============================================================================

const createDocumentSchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().max(1000).optional(),
	mimeType: z.enum(ALLOWED_MIME_TYPES),
	fileSize: z.number().max(MAX_FILE_SIZE, {
		message: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
	}),
	fileName: z.string().min(1).max(255),
	fileData: z.string(), // Base64 encoded file data
});

const updateDocumentSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(255).optional(),
	description: z.string().max(1000).nullable().optional(),
	publishStatus: z.enum(["draft", "published", "archived"]).optional(),
});

const listDocumentsSchema = z
	.object({
		limit: z.number().int().min(1).max(100).default(50),
		page: z.number().int().min(1).default(1),
		sortOrder: z.enum(["asc", "desc"]).default("desc"),
		publishStatus: z.enum(["draft", "published", "archived"]).optional(),
	})
	.optional();

// ============================================================================
// Documents Router
// ============================================================================

export const documentsRouter = t.router({
	// -------------------------------------------------------------------------
	// CREATE – upload new document
	// -------------------------------------------------------------------------
	create: protectedProcedure
		.use(createPermissionMiddleware("documents", ["write"]))
		.input(createDocumentSchema)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getContentDb(env);
			const { name, description, mimeType, fileSize, fileName, fileData } =
				input;

			try {
				if (!validateFileExtension(fileName)) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
					});
				}

				const binaryData = Uint8Array.from(atob(fileData), (c) =>
					c.charCodeAt(0),
				);

				if (binaryData.length > MAX_FILE_SIZE) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
					});
				}

				const key = await generateUniqueDocumentKey(env.R2_ASSETS, fileName);

				await env.R2_ASSETS.put(key, binaryData, {
					httpMetadata: {
						contentType: mimeType,
						cacheControl: "public, max-age=31536000",
					},
					customMetadata: {
						uploadedAt: new Date().toISOString(),
					},
				});

				const fileUrl = `https://assets.airwartrail.com/${key}`;

				const id = generateDocumentId();
				const now = new Date();

				await db.insert(documents).values({
					id,
					name,
					description,
					fileUrl,
					fileSize,
					mimeType,
					publishStatus: "draft",
					author: ctx.user.name || "Unknown",
					authorId: ctx.user.id,
					createdAt: now,
					updatedAt: now,
				});

				return {
					id,
					name,
					description,
					fileUrl,
					fileSize,
					mimeType,
					publishStatus: "draft",
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error creating document:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create document",
				});
			}
		}),

	// -------------------------------------------------------------------------
	// LIST – paginated listing
	// -------------------------------------------------------------------------
	list: protectedProcedure
		.use(createPermissionMiddleware("documents", ["read"]))
		.input(listDocumentsSchema)
		.query(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);
			const limit = input?.limit ?? 50;
			const page = input?.page ?? 1;
			const offset = (page - 1) * limit;
			const order = input?.sortOrder === "asc" ? asc : desc;

			const conditions = input?.publishStatus
				? [eq(documents.publishStatus, input.publishStatus)]
				: [];

			const [items, totalResult] = await Promise.all([
				db
					.select()
					.from(documents)
					.where(and(...conditions))
					.orderBy(order(documents.createdAt))
					.limit(limit)
					.offset(offset),
				db.select({ total: count() }).from(documents),
			]);

			const total = totalResult[0]?.total ?? 0;

			return {
				documents: items,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			};
		}),

	// -------------------------------------------------------------------------
	// LIST PUBLIC – public listing of published documents
	// -------------------------------------------------------------------------
	listPublic: protectedProcedure
		.use(createPermissionMiddleware("documents", ["read"]))
		.input(listDocumentsSchema)
		.query(async () => {
			throw new TRPCError({
				code: "NOT_IMPLEMENTED",
				message: "Use list with authentication for now",
			});
		}),

	// -------------------------------------------------------------------------
	// GET – single document by ID
	// -------------------------------------------------------------------------
	get: protectedProcedure
		.use(createPermissionMiddleware("documents", ["read"]))
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);

			const [document] = await db
				.select()
				.from(documents)
				.where(eq(documents.id, input.id))
				.limit(1);

			if (!document) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Document not found",
				});
			}

			return document;
		}),

	// -------------------------------------------------------------------------
	// UPDATE – update document metadata
	// -------------------------------------------------------------------------
	update: protectedProcedure
		.use(createPermissionMiddleware("documents", ["write"]))
		.input(updateDocumentSchema)
		.mutation(async ({ ctx, input }) => {
			const db = getContentDb(ctx.env);
			const { id, name, description, publishStatus } = input;

			const [existing] = await db
				.select()
				.from(documents)
				.where(eq(documents.id, id))
				.limit(1);

			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Document not found",
				});
			}

			const updateData: Record<string, unknown> = {
				updatedAt: new Date(),
			};

			if (name !== undefined) updateData.name = name;
			if (description !== undefined) updateData.description = description;
			if (publishStatus !== undefined)
				updateData.publishStatus = publishStatus;

			await db.update(documents).set(updateData).where(eq(documents.id, id));

			const [updated] = await db
				.select()
				.from(documents)
				.where(eq(documents.id, id))
				.limit(1);

			return updated;
		}),

	// -------------------------------------------------------------------------
	// DELETE – delete document and remove from R2
	// -------------------------------------------------------------------------
	delete: protectedProcedure
		.use(createPermissionMiddleware("documents", ["delete"]))
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getContentDb(env);

			const [document] = await db
				.select()
				.from(documents)
				.where(eq(documents.id, input.id))
				.limit(1);

			if (!document) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Document not found",
				});
			}

			// Delete from R2
			const key = getKeyFromUrl(document.fileUrl);
			if (key) {
				try {
					await env.R2_ASSETS.delete(key);
				} catch (deleteError) {
					console.warn("Failed to delete document from R2:", deleteError);
				}
			}

			// Delete from database
			await db.delete(documents).where(eq(documents.id, input.id));

			return { success: true, deleted: true };
		}),

	// -------------------------------------------------------------------------
	// GET UPLOAD URL – prepare for upload, get R2 key
	// -------------------------------------------------------------------------
	getUploadUrl: protectedProcedure
		.use(createPermissionMiddleware("documents", ["write"]))
		.input(
			z.object({
				fileName: z.string().min(1).max(255),
				mimeType: z.enum(ALLOWED_MIME_TYPES),
				fileSize: z.number().max(MAX_FILE_SIZE, {
					message: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
				}),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const { fileName, mimeType } = input;

			try {
				if (!validateFileExtension(fileName)) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
					});
				}

				const key = await generateUniqueDocumentKey(env.R2_ASSETS, fileName);

				return {
					key,
					mimeType,
					maxFileSize: MAX_FILE_SIZE,
					fileUrl: `https://assets.airwartrail.com/${key}`,
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

	// -------------------------------------------------------------------------
	// CONFIRM UPLOAD – save document record after R2 upload
	// -------------------------------------------------------------------------
	confirmUpload: protectedProcedure
		.use(createPermissionMiddleware("documents", ["write"]))
		.input(
			z.object({
				name: z.string().min(1).max(255),
				description: z.string().max(1000).optional(),
				fileUrl: z.string().url(),
				fileSize: z.number(),
				mimeType: z.enum(ALLOWED_MIME_TYPES),
				publishStatus: z.enum(["draft", "published", "archived"]).default("draft"),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getContentDb(env);
			const { name, description, fileUrl, fileSize, mimeType, publishStatus } =
				input;

			try {
				const id = generateDocumentId();
				const now = new Date();

				await db.insert(documents).values({
					id,
					name,
					description,
					fileUrl,
					fileSize,
					mimeType,
					publishStatus,
					author: ctx.user.name || "Unknown",
					authorId: ctx.user.id,
					createdAt: now,
					updatedAt: now,
				});

				return {
					id,
					name,
					description,
					fileUrl,
					fileSize,
					mimeType,
					publishStatus,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error confirming upload:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to confirm upload",
				});
			}
		}),
});
