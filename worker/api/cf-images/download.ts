import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "@/lib/auth-server";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "@/db/content-schema";

// ---------------------------------------------------------------------------
// Image Download Router
// ---------------------------------------------------------------------------
// Streams the original (base) image blob from Cloudflare Images API.
// This bypasses the variant/delivery pipeline so the user gets the original
// uploaded file in its original format (JPEG, PNG, etc.) – no WebP/AVIF
// transcoding.
//
// Endpoint: GET /api/images/download/:imageId
// Auth:     Cookie session or x-api-key header (same as tRPC routes)
// ---------------------------------------------------------------------------

export const imageDownloadRouter = new Hono<{ Bindings: Env }>();

// CORS – mirror the same policy used on other API routes
imageDownloadRouter.use(
	"*",
	cors({
		origin: (origin) => origin,
		allowHeaders: ["Content-Type", "Authorization", "x-api-key"],
		allowMethods: ["GET", "OPTIONS"],
		exposeHeaders: ["Content-Length", "Content-Disposition", "Content-Type"],
		maxAge: 600,
		credentials: true,
	}),
);

// Auth middleware – reuses the same pattern from entry.ts
imageDownloadRouter.use("*", async (c, next) => {
	const apiKey = c.req.header("x-api-key");

	const session = await auth.api.getSession({
		headers: c.req.raw.headers,
	});

	if (!session && !apiKey) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	if (!session && apiKey) {
		try {
			const verifyResult = await auth.api.verifyApiKey({
				body: { key: apiKey },
			});
			if (!verifyResult.valid) {
				return c.json({ error: "Invalid API key" }, 401);
			}
		} catch {
			return c.json({ error: "Invalid API key" }, 401);
		}
	}

	await next();
});

// GET /api/images/download/:imageId
imageDownloadRouter.get("/:imageId", async (c) => {
	const { imageId } = c.req.param();
	const env = c.env;

	// Look up the DB record to get the CF image ID and filename
	const db = drizzle(env.DB_CONTENT, { schema });
	const records = await db
		.select()
		.from(schema.images)
		.where(eq(schema.images.id, imageId))
		.limit(1);

	if (records.length === 0) {
		return c.json({ error: "Image not found" }, 404);
	}

	const image = records[0];

	// Fetch the original blob from Cloudflare Images API
	const blobUrl = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/images/v1/${image.cfImageId}/blob`;

	const cfRes = await fetch(blobUrl, {
		headers: {
			Authorization: `Bearer ${env.CLOUDFLARE_IMAGES_API_KEY}`,
		},
	});

	if (!cfRes.ok) {
		console.error(
			`CF Images blob fetch failed: ${cfRes.status} ${cfRes.statusText}`,
		);
		return c.json(
			{ error: "Failed to fetch original image from Cloudflare" },
			502,
		);
	}

	// Build a useful download filename
	const originalName = image.fileName || image.id;
	// Ensure the filename has an extension – fall back to the content-type from CF
	const contentType = cfRes.headers.get("Content-Type") || "application/octet-stream";
	const fileName = ensureExtension(originalName, contentType);

	// Stream the blob back to the client with download headers
	return new Response(cfRes.body, {
		status: 200,
		headers: {
			"Content-Type": contentType,
			"Content-Disposition": `attachment; filename="${encodeFileName(fileName)}"`,
			...(cfRes.headers.has("Content-Length")
				? { "Content-Length": cfRes.headers.get("Content-Length")! }
				: {}),
			// Cache for 5 minutes on client – originals don't change
			"Cache-Control": "private, max-age=300",
		},
	});
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map common MIME types to file extensions. */
const MIME_TO_EXT: Record<string, string> = {
	"image/jpeg": ".jpg",
	"image/png": ".png",
	"image/gif": ".gif",
	"image/webp": ".webp",
	"image/avif": ".avif",
	"image/svg+xml": ".svg",
	"image/tiff": ".tiff",
	"image/bmp": ".bmp",
};

/** Make sure the filename has an extension. If it doesn't, infer from MIME type. */
function ensureExtension(name: string, mimeType: string): string {
	const lastDot = name.lastIndexOf(".");
	if (lastDot > 0 && lastDot < name.length - 1) {
		// Already has an extension
		return name;
	}
	const ext = MIME_TO_EXT[mimeType] || "";
	return `${name}${ext}`;
}

/** Encode filename for Content-Disposition (handles UTF-8 names). */
function encodeFileName(name: string): string {
	// Replace any characters that would break the header
	return name.replace(/["\\\n\r]/g, "_");
}
