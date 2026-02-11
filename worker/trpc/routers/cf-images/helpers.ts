import { TRPCError } from "@trpc/server";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/content-schema";

// ---------------------------------------------------------------------------
// Database Helper
// ---------------------------------------------------------------------------

export function getContentDb(env: Env) {
	return drizzle(env.DB_CONTENT, { schema });
}

// ---------------------------------------------------------------------------
// Cloudflare Images API Helpers
// ---------------------------------------------------------------------------

/** Build the base Cloudflare Images API URL for this account. */
export function cfImagesUrl(accountId: string, path = "") {
	return `https://api.cloudflare.com/client/v4/accounts/${accountId}/images${path}`;
}

/** Standard headers for Cloudflare API calls. */
export function cfHeaders(apiToken: string): Record<string, string> {
	return {
		Authorization: `Bearer ${apiToken}`,
	};
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** CF Images API response shape for a single image. */
export type CfImageResult = {
	id: string;
	filename: string;
	uploaded: string;
	requireSignedURLs: boolean;
	variants: string[];
	meta?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Response Helpers
// ---------------------------------------------------------------------------

/** Unwrap CF API JSON envelope – throws a TRPCError on failure. */
export async function unwrapCfResponse<T = unknown>(
	res: Response,
	errorMsg: string,
): Promise<T> {
	const json = (await res.json()) as {
		success: boolean;
		result: T;
		errors: { code: number; message: string }[];
	};

	if (!json.success) {
		const detail = json.errors?.map((e) => e.message).join("; ") ?? "Unknown";
		console.error(`${errorMsg}:`, detail);
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: `${errorMsg}: ${detail}`,
		});
	}

	return json.result;
}

// ---------------------------------------------------------------------------
// CF Metadata Helpers
// ---------------------------------------------------------------------------

/** Static creator tag so images from this project are identifiable in the account-level CF Images dashboard. */
export const CF_CREATOR = "airwartrail" as const;

/**
 * Build the metadata object sent to Cloudflare Images.
 * Optionally includes the internal DB `dbId`.
 * User-supplied metadata is merged in (CF fields take priority).
 * Note: `creator` is a separate CF API field, not part of metadata.
 */
export function buildCfMetadata(
	dbId?: string,
	userMeta?: Record<string, unknown>,
): Record<string, unknown> {
	return {
		...(userMeta ?? {}),
		...(dbId ? { dbId } : {}),
	};
}

/**
 * Convert an imagedelivery.net URL to use a custom domain via cdn-cgi path.
 *
 * Input:  https://imagedelivery.net/<HASH>/<IMAGE_ID>
 * Output: https://www.airwartrail.com/cdn-cgi/imagedelivery/<HASH>/<IMAGE_ID>
 *
 * @param deliveryUrl - The original imagedelivery.net URL
 * @param customDomain - Optional custom domain (e.g. "www.airwartrail.com")
 * @returns The URL with custom domain prefix, or original if no custom domain
 */
export function toCustomDomainUrl(
	deliveryUrl: string,
	customDomain?: string,
): string {
	if (!customDomain) return deliveryUrl;

	// Extract path after imagedelivery.net: /<HASH>/<IMAGE_ID>
	const match = deliveryUrl.match(
		/^https:\/\/imagedelivery\.net\/(.+)$/,
	);
	if (!match) return deliveryUrl;

	const pathAfterDomain = match[1]; // <HASH>/<IMAGE_ID>
	return `https://${customDomain}/cdn-cgi/imagedelivery/${pathAfterDomain}`;
}

/**
 * Extract the base delivery URL from a CF Images variant URL.
 * Variant URLs look like: https://imagedelivery.net/<hash>/<image-id>/public
 * We store the base without the variant: https://imagedelivery.net/<hash>/<image-id>
 *
 * If a custom domain is provided, the URL is converted to use that domain
 * via the /cdn-cgi/imagedelivery/ path.
 *
 * @param variants - Array of variant URLs from CF Images API
 * @param customDomain - Optional custom domain for serving images (e.g. "www.airwartrail.com")
 * @returns Base delivery URL (optionally with custom domain)
 */
export function extractDeliveryUrl(
	variants: string[],
	customDomain?: string,
): string {
	if (variants.length === 0) return "";
	const url = variants[0];
	const lastSlash = url.lastIndexOf("/");
	const baseUrl = lastSlash > 0 ? url.substring(0, lastSlash) : url;
	return toCustomDomainUrl(baseUrl, customDomain);
}

// ---------------------------------------------------------------------------
// Signed URL Helpers
// ---------------------------------------------------------------------------

/** Default signed URL expiration: 1 hour (in seconds). */
export const DEFAULT_SIGNED_URL_EXPIRATION = 60 * 60;

/** Convert an ArrayBuffer to a lowercase hex string. */
function bufferToHex(buffer: ArrayBuffer): string {
	return [...new Uint8Array(buffer)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * Import the CF Images signing key as a CryptoKey for HMAC-SHA256.
 * The key is the one from the CF dashboard → Images → Keys.
 */
async function importSigningKey(signingKey: string): Promise<CryptoKey> {
	const encoder = new TextEncoder();
	return crypto.subtle.importKey(
		"raw",
		encoder.encode(signingKey),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
}

/**
 * Extract the Cloudflare Images path from a delivery URL.
 * Handles both imagedelivery.net URLs and custom domain URLs with /cdn-cgi/imagedelivery/.
 *
 * Input formats:
 *   - https://imagedelivery.net/<hash>/<image-id>
 *   - https://www.example.com/cdn-cgi/imagedelivery/<hash>/<image-id>
 *
 * @returns The path portion: /<hash>/<image-id>
 */
function extractCfImagesPath(deliveryUrl: string): string {
	// Custom domain format: /cdn-cgi/imagedelivery/<hash>/<image-id>
	const cdnCgiMatch = deliveryUrl.match(
		/\/cdn-cgi\/imagedelivery(\/[^?]+)/,
	);
	if (cdnCgiMatch) {
		return cdnCgiMatch[1]; // /<hash>/<image-id>
	}

	// Standard format: https://imagedelivery.net/<hash>/<image-id>
	const standardMatch = deliveryUrl.match(
		/^https:\/\/imagedelivery\.net(\/[^?]+)/,
	);
	if (standardMatch) {
		return standardMatch[1]; // /<hash>/<image-id>
	}

	// Fallback: use URL pathname
	return new URL(deliveryUrl).pathname;
}

/**
 * Generate a signed URL for a Cloudflare Images delivery URL.
 *
 * CF signed URLs use HMAC-SHA256 over `pathname?exp=<unix>` and attach
 * `?exp=…&sig=…` query parameters. Works only with **named variants**
 * (flexible variant params like `w=` are not supported for signed URLs).
 *
 * IMPORTANT: The signature must be computed over the Cloudflare Images path
 * (/<hash>/<image-id>/<variant>), NOT the full custom domain path. This is
 * because Cloudflare validates signatures against the original path regardless
 * of whether a custom domain is used.
 *
 * @param deliveryUrl  Base delivery URL without variant (e.g. https://imagedelivery.net/<hash>/<id>)
 * @param variant      Named variant (e.g. "public", "thumbnail", "mobile")
 * @param signingKey   Signing key from CF Images dashboard
 * @param expirationSeconds  How long the URL is valid (default: 1 hour)
 * @returns  Fully signed delivery URL with ?exp=…&sig=…
 */
export async function generateSignedUrl(
	deliveryUrl: string,
	variant: string,
	signingKey: string,
	expirationSeconds = DEFAULT_SIGNED_URL_EXPIRATION,
): Promise<string> {
	const url = new URL(`${deliveryUrl}/${variant}`);

	// Attach expiration
	const expiry = Math.floor(Date.now() / 1000) + expirationSeconds;
	url.searchParams.set("exp", String(expiry));

	// Extract the CF Images path for signing (handles custom domain URLs)
	// The signature must be over /<hash>/<image-id>/<variant>, not the full path
	const cfImagesPath = extractCfImagesPath(deliveryUrl) + "/" + variant;

	// Sign: CF Images path + "?" + searchParams
	const stringToSign = cfImagesPath + "?" + url.searchParams.toString();
	const encoder = new TextEncoder();
	const key = await importSigningKey(signingKey);
	const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(stringToSign));
	const sig = bufferToHex(mac);

	url.searchParams.set("sig", sig);

	return url.toString();
}

/**
 * Generate signed URLs for multiple named variants of a single image.
 * Useful for building `<img srcset="…">` with signed private images.
 *
 * @param deliveryUrl  Base delivery URL without variant
 * @param variants     Array of named variant strings (e.g. ["mobile", "tablet", "desktop"])
 * @param signingKey   Signing key from CF Images dashboard
 * @param expirationSeconds  How long the URLs are valid (default: 1 hour)
 * @returns  Array of { variant, url } objects
 */
export async function generateSignedUrls(
	deliveryUrl: string,
	variants: string[],
	signingKey: string,
	expirationSeconds = DEFAULT_SIGNED_URL_EXPIRATION,
): Promise<{ variant: string; url: string }[]> {
	return Promise.all(
		variants.map(async (variant) => ({
			variant,
			url: await generateSignedUrl(deliveryUrl, variant, signingKey, expirationSeconds),
		})),
	);
}
