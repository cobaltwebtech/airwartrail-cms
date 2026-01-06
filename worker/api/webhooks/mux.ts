import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { video, muxLibrary } from "@/db/video-schema";
import { generateVideoId } from "@/worker/lib/generate-id";
import { decrypt } from "@/worker/lib/encryption";

/**
 * Mux Webhook Handler
 * 
 * Handles incoming webhooks from Mux for video upload and processing events.
 * 
 * Key events handled:
 * - video.upload.asset_created: Upload completed, asset created
 * - video.asset.ready: Video processed and ready for playback
 * - video.asset.errored: Video processing failed
 * 
 * @see https://docs.mux.com/guides/listen-for-webhooks
 */

// ============================================================================
// Types
// ============================================================================

interface MuxWebhookPayload {
	type: string;
	id: string;
	created_at: string;
	object: {
		type: string;
		id: string;
	};
	environment?: {
		name: string;
		id: string;
	};
	data: Record<string, unknown>;
	attempts?: Array<{
		webhook_id: number;
		response_status_code: number;
		response_headers: Record<string, string>;
		response_body: string;
		max_attempts: number;
		id: string;
		created_at: string;
		address: string;
	}>;
	accessor?: string;
	accessor_source?: string;
	request_id?: string;
}

interface MuxUploadData {
	id: string;
	timeout: number;
	status: "waiting" | "asset_created" | "errored" | "cancelled" | "timed_out";
	new_asset_settings?: {
		playback_policies?: string[];
		video_quality?: string;
		meta?: Record<string, unknown>;
	};
	asset_id?: string;
	error?: {
		type: string;
		message: string;
	};
	cors_origin?: string;
	url?: string;
	test?: boolean;
}

interface MuxAssetData {
	id: string;
	created_at: string;
	status: "preparing" | "ready" | "errored";
	duration?: number;
	max_stored_resolution?: string;
	max_stored_frame_rate?: number;
	aspect_ratio?: string;
	playback_ids?: Array<{
		id: string;
		policy: "public" | "signed";
	}>;
	tracks?: Array<{
		id: string;
		type: string;
		max_width?: number;
		max_height?: number;
		max_frame_rate?: number;
		duration?: number;
		max_channels?: number;
		max_channel_layout?: string;
		text_type?: string;
		text_source?: string;
		language_code?: string;
		name?: string;
		closed_captions?: boolean;
	}>;
	errors?: {
		type: string;
		messages: string[];
	};
	upload_id?: string;
	ingest_type?: string;
	resolution_tier?: string;
	video_quality?: string;
	meta?: Record<string, unknown>;
	passthrough?: string;
	test?: boolean;
	max_resolution_tier?: string;
	encoding_tier?: string;
}

// ============================================================================
// Webhook Signature Verification
// ============================================================================

/**
 * Verify the Mux webhook signature using HMAC-SHA256
 * 
 * Mux sends a signature in the `mux-signature` header in the format:
 * `t={timestamp},v1={signature}`
 * 
 * @see https://docs.mux.com/guides/listen-for-webhooks#verify-webhook-signatures
 */
async function verifyWebhookSignature(
	payload: string,
	signature: string | null,
	secret: string,
	toleranceInSeconds: number = 300, // 5 minutes
): Promise<boolean> {
	if (!signature) {
		console.error("Missing mux-signature header");
		return false;
	}

	// Parse the signature header
	const parts = signature.split(",");
	const timestampPart = parts.find((p) => p.startsWith("t="));
	const signaturePart = parts.find((p) => p.startsWith("v1="));

	if (!timestampPart || !signaturePart) {
		console.error("Invalid signature format");
		return false;
	}

	const timestamp = timestampPart.slice(2);
	const expectedSignature = signaturePart.slice(3);

	// Check if the timestamp is within tolerance
	const currentTime = Math.floor(Date.now() / 1000);
	const webhookTime = parseInt(timestamp, 10);

	if (Math.abs(currentTime - webhookTime) > toleranceInSeconds) {
		console.error("Webhook timestamp outside tolerance window");
		return false;
	}

	// Create the signed payload string (timestamp.payload)
	const signedPayload = `${timestamp}.${payload}`;

	// Generate the expected signature using HMAC-SHA256
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const signatureBuffer = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(signedPayload),
	);

	// Convert to hex string
	const computedSignature = Array.from(new Uint8Array(signatureBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	// Compare signatures using timing-safe comparison
	if (computedSignature.length !== expectedSignature.length) {
		return false;
	}

	let result = 0;
	for (let i = 0; i < computedSignature.length; i++) {
		result |= computedSignature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
	}

	return result === 0;
}

// ============================================================================
// Database Helpers
// ============================================================================

function getVideosDb(env: Env) {
	return drizzle(env.DB_VIDEOS);
}

/**
 * Look up the webhook secret for a Mux environment
 * First tries to match by muxEnvironmentId, then falls back to trying all libraries
 */
async function getWebhookSecretForEnvironment(
	db: ReturnType<typeof getVideosDb>,
	muxEnvironmentId: string | undefined,
	encryptionSecret: string,
): Promise<{ secret: string; libraryId: string } | null> {
	// Try to find library by Mux environment ID
	if (muxEnvironmentId) {
		const library = await db
			.select({ 
				id: muxLibrary.id, 
				webhookSecret: muxLibrary.webhookSecret 
			})
			.from(muxLibrary)
			.where(
				and(
					eq(muxLibrary.muxEnvironmentId, muxEnvironmentId),
					eq(muxLibrary.isActive, true)
				)
			)
			.limit(1);

		if (library[0]?.webhookSecret) {
			try {
				const decryptedSecret = await decrypt(library[0].webhookSecret, encryptionSecret);
				return { secret: decryptedSecret, libraryId: library[0].id };
			} catch (error) {
				console.warn("Failed to decrypt webhook secret:", error);
				// Try using raw value in case it's not encrypted (migration)
				return { secret: library[0].webhookSecret, libraryId: library[0].id };
			}
		}
	}

	// Fallback: return the first library with a webhook secret (for single-library setups)
	const anyLibrary = await db
		.select({ 
			id: muxLibrary.id, 
			webhookSecret: muxLibrary.webhookSecret 
		})
		.from(muxLibrary)
		.where(eq(muxLibrary.isActive, true))
		.limit(10);

	for (const lib of anyLibrary) {
		if (lib.webhookSecret) {
			try {
				const decryptedSecret = await decrypt(lib.webhookSecret, encryptionSecret);
				return { secret: decryptedSecret, libraryId: lib.id };
			} catch {
				return { secret: lib.webhookSecret, libraryId: lib.id };
			}
		}
	}

	return null;
}



// ============================================================================
// Webhook Handlers
// ============================================================================

/**
 * Handle video.upload.asset_created event
 * 
 * This event fires when a direct upload completes and an asset is created.
 * We use this to create or update the video record in our database.
 */
async function handleUploadAssetCreated(
	db: ReturnType<typeof getVideosDb>,
	data: MuxUploadData,
): Promise<{ success: boolean; message: string }> {
	const { id: uploadId, asset_id: assetId } = data;

	if (!assetId) {
		return { success: false, message: "No asset_id in upload data" };
	}

	console.log(`Processing upload.asset_created: upload=${uploadId}, asset=${assetId}`);

	// Check if we already have a video with this upload ID
	const existingByUpload = await db
		.select({ id: video.id })
		.from(video)
		.where(eq(video.muxUploadId, uploadId))
		.limit(1);

	if (existingByUpload.length > 0) {
		// Update existing video with the asset ID
		await db
			.update(video)
			.set({
				muxAssetId: assetId,
				status: "preparing",
				updatedAt: new Date(),
			})
			.where(eq(video.muxUploadId, uploadId));

		return { 
			success: true, 
			message: `Updated video ${existingByUpload[0].id} with asset ID ${assetId}` 
		};
	}

	// Check if we already have a video with this asset ID (created via sync)
	const existingByAsset = await db
		.select({ id: video.id })
		.from(video)
		.where(eq(video.muxAssetId, assetId))
		.limit(1);

	if (existingByAsset.length > 0) {
		// Update with upload ID if not set
		await db
			.update(video)
			.set({
				muxUploadId: uploadId,
				updatedAt: new Date(),
			})
			.where(eq(video.muxAssetId, assetId));

		return { 
			success: true, 
			message: `Video ${existingByAsset[0].id} already exists, updated upload ID` 
		};
	}

	// Video doesn't exist yet - it will be created when synced or when asset.ready fires
	return { 
		success: true, 
		message: `Upload ${uploadId} completed with asset ${assetId}, awaiting sync or asset.ready` 
	};
}

/**
 * Handle video.asset.ready event
 * 
 * This event fires when Mux has finished processing the video
 * and it's ready for playback.
 */
async function handleAssetReady(
	db: ReturnType<typeof getVideosDb>,
	data: MuxAssetData,
): Promise<{ success: boolean; message: string }> {
	const {
		id: assetId,
		playback_ids,
		duration,
		aspect_ratio,
		max_stored_resolution,
		max_stored_frame_rate,
		resolution_tier,
		video_quality,
		upload_id,
		ingest_type,
		meta,
		test,
	} = data;

	const playbackId = playback_ids?.[0]?.id ?? null;
	const playbackPolicy = playback_ids?.[0]?.policy ?? "public";

	console.log(`Processing asset.ready: asset=${assetId}, playbackId=${playbackId}`);

	// Try to find existing video by asset ID or upload ID
	let existingVideo = await db
		.select({ id: video.id, libraryId: video.libraryId })
		.from(video)
		.where(eq(video.muxAssetId, assetId))
		.limit(1);

	if (existingVideo.length === 0 && upload_id) {
		existingVideo = await db
			.select({ id: video.id, libraryId: video.libraryId })
			.from(video)
			.where(eq(video.muxUploadId, upload_id))
			.limit(1);
	}

	// Parse resolution dimensions
	let maxWidth: number | null = null;
	let maxHeight: number | null = null;
	if (max_stored_resolution && max_stored_resolution !== "Audio only") {
		const [w, h] = max_stored_resolution.split("x").map(Number);
		maxWidth = w || null;
		maxHeight = h || null;
	}

	if (existingVideo.length > 0) {
		// Update existing video with ready status and all metadata
		await db
			.update(video)
			.set({
				muxAssetId: assetId,
				muxPlaybackId: playbackId,
				muxUploadId: upload_id ?? undefined,
				status: "ready",
				duration: duration ?? null,
				aspectRatio: aspect_ratio ?? null,
				maxWidth,
				maxHeight,
				maxFrameRate: max_stored_frame_rate ?? null,
				resolutionTier: resolution_tier as "audio-only" | "720p" | "1080p" | "1440p" | "2160p" | null,
				videoQuality: video_quality as "basic" | "plus" | "premium" | null,
				playbackPolicy: playbackPolicy as "public" | "signed",
				ingestType: ingest_type as "on_demand_url" | "on_demand_direct_upload" | "on_demand_clip" | "live_rtmp" | "live_srt" | null,
				isTest: test ?? false,
				updatedAt: new Date(),
			})
			.where(eq(video.id, existingVideo[0].id));

		return {
			success: true,
			message: `Video ${existingVideo[0].id} marked as ready`,
		};
	}

	// Video doesn't exist - create it with default library
	// This handles cases where the video was uploaded but not synced
	const defaultLibrary = await db
		.select({ id: muxLibrary.id, defaultPlaybackPolicy: muxLibrary.defaultPlaybackPolicy, defaultVideoQuality: muxLibrary.defaultVideoQuality })
		.from(muxLibrary)
		.where(and(eq(muxLibrary.isDefault, true), eq(muxLibrary.isActive, true)))
		.limit(1);

	if (defaultLibrary.length === 0) {
		return {
			success: false,
			message: "No default library configured to create video",
		};
	}

	const newVideoId = generateVideoId();
	const title = (meta?.title as string) || "Untitled";

	await db.insert(video).values({
		id: newVideoId,
		libraryId: defaultLibrary[0].id,
		muxAssetId: assetId,
		muxPlaybackId: playbackId,
		muxUploadId: upload_id ?? null,
		status: "ready",
		title,
		duration: duration ?? null,
		aspectRatio: aspect_ratio ?? null,
		maxWidth,
		maxHeight,
		maxFrameRate: max_stored_frame_rate ?? null,
		resolutionTier: resolution_tier as "audio-only" | "720p" | "1080p" | "1440p" | "2160p" | null,
		videoQuality: (video_quality as "basic" | "plus" | "premium") ?? defaultLibrary[0].defaultVideoQuality,
		playbackPolicy: playbackPolicy as "public" | "signed",
		passthrough: newVideoId,
		externalId: newVideoId,
		ingestType: ingest_type as "on_demand_url" | "on_demand_direct_upload" | "on_demand_clip" | "live_rtmp" | "live_srt" | null,
		isTest: test ?? false,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	return {
		success: true,
		message: `Created new video ${newVideoId} from webhook`,
	};
}

/**
 * Handle video.asset.errored event
 * 
 * This event fires when Mux fails to process the video.
 */
async function handleAssetErrored(
	db: ReturnType<typeof getVideosDb>,
	data: MuxAssetData,
): Promise<{ success: boolean; message: string }> {
	const { id: assetId, errors, upload_id } = data;

	console.log(`Processing asset.errored: asset=${assetId}`, errors);

	// Try to find existing video
	let existingVideo = await db
		.select({ id: video.id })
		.from(video)
		.where(eq(video.muxAssetId, assetId))
		.limit(1);

	if (existingVideo.length === 0 && upload_id) {
		existingVideo = await db
			.select({ id: video.id })
			.from(video)
			.where(eq(video.muxUploadId, upload_id))
			.limit(1);
	}

	if (existingVideo.length > 0) {
		await db
			.update(video)
			.set({
				status: "errored",
				errorType: errors?.type ?? "unknown",
				errorMessages: JSON.stringify(errors?.messages ?? []),
				updatedAt: new Date(),
			})
			.where(eq(video.id, existingVideo[0].id));

		return {
			success: true,
			message: `Video ${existingVideo[0].id} marked as errored`,
		};
	}

	return {
		success: true,
		message: `Asset ${assetId} errored but no matching video found`,
	};
}

/**
 * Handle video.asset.updated event
 * 
 * This event fires when an asset's metadata is updated in Mux.
 * This includes title changes, metadata updates, etc.
 */
async function handleAssetUpdated(
	db: ReturnType<typeof getVideosDb>,
	data: MuxAssetData,
): Promise<{ success: boolean; message: string }> {
	const {
		id: assetId,
		playback_ids,
		duration,
		aspect_ratio,
		max_stored_frame_rate,
		resolution_tier,
		video_quality,
		meta,
		tracks,
	} = data;

	console.log(`Processing asset.updated: asset=${assetId}`);

	// Find existing video by asset ID or external_id from meta
	let existingVideo = await db
		.select({ id: video.id, title: video.title })
		.from(video)
		.where(eq(video.muxAssetId, assetId))
		.limit(1);

	// Fallback: try to find by external_id if provided in meta
	if (existingVideo.length === 0 && meta?.external_id && typeof meta.external_id === "string") {
		existingVideo = await db
			.select({ id: video.id, title: video.title })
			.from(video)
			.where(eq(video.externalId, meta.external_id))
			.limit(1);
	}

	if (existingVideo.length === 0) {
		return {
			success: true,
			message: `Asset ${assetId} updated but no matching video found in database`,
		};
	}

	// Extract resolution from video track
	let maxWidth: number | null = null;
	let maxHeight: number | null = null;
	const videoTrack = tracks?.find((t) => t.type === "video");
	if (videoTrack) {
		maxWidth = videoTrack.max_width ?? null;
		maxHeight = videoTrack.max_height ?? null;
	}

	const playbackId = playback_ids?.[0]?.id ?? null;
	const playbackPolicy = playback_ids?.[0]?.policy ?? "public";

	// Build update object with available fields
	const updateData: Record<string, unknown> = {
		updatedAt: new Date(),
	};

	// Update title if provided in meta
	if (meta?.title && typeof meta.title === "string") {
		updateData.title = meta.title;
	}

	// Update other metadata if available
	if (playbackId) updateData.muxPlaybackId = playbackId;
	if (playbackPolicy) updateData.playbackPolicy = playbackPolicy as "public" | "signed";
	if (duration !== undefined) updateData.duration = duration;
	if (aspect_ratio) updateData.aspectRatio = aspect_ratio;
	if (maxWidth !== null) updateData.maxWidth = maxWidth;
	if (maxHeight !== null) updateData.maxHeight = maxHeight;
	if (max_stored_frame_rate) updateData.maxFrameRate = max_stored_frame_rate;
	if (resolution_tier) updateData.resolutionTier = resolution_tier as "audio-only" | "720p" | "1080p" | "1440p" | "2160p";
	if (video_quality) updateData.videoQuality = video_quality as "basic" | "plus" | "premium";

	await db
		.update(video)
		.set(updateData)
		.where(eq(video.id, existingVideo[0].id));

	const titleUpdated = meta?.title ? ` (title: "${meta.title}")` : "";
	return {
		success: true,
		message: `Video ${existingVideo[0].id} updated from webhook${titleUpdated}`,
	};
}

/**
 * Handle video.asset.deleted event
 * 
 * This event fires when an asset is deleted from Mux.
 */
async function handleAssetDeleted(
	db: ReturnType<typeof getVideosDb>,
	data: MuxAssetData,
): Promise<{ success: boolean; message: string }> {
	const { id: assetId } = data;

	console.log(`Processing asset.deleted: asset=${assetId}`);

	// Soft delete the video in our database
	await db
		.update(video)
		.set({
			isDeleted: true,
			deletedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(video.muxAssetId, assetId));

	return {
		success: true,
		message: `Processed deletion for asset ${assetId}`,
	};
}

// ============================================================================
// Router
// ============================================================================

export const muxWebhookRouter = new Hono<{ Bindings: Env }>();

/**
 * POST /api/webhooks/mux
 * 
 * Main webhook endpoint for Mux events.
 * Verifies signature and routes to appropriate handler.
 */
muxWebhookRouter.post("/", async (c) => {
	const db = getVideosDb(c.env);
	const encryptionSecret = c.env.DB_VIDEOS_SECRET;

	// Get the raw body for signature verification
	const rawBody = await c.req.text();

	// Parse the webhook payload first to get environment info
	let payload: MuxWebhookPayload;
	try {
		payload = JSON.parse(rawBody);
	} catch {
		console.error("Invalid JSON payload");
		return c.json({ error: "Invalid JSON" }, 400);
	}

	const muxEnvironmentId = payload.environment?.id;

	// Look up webhook secret from database based on Mux environment ID
	const webhookConfig = encryptionSecret 
		? await getWebhookSecretForEnvironment(db, muxEnvironmentId, encryptionSecret)
		: null;

	// Verify webhook signature if we have a secret configured
	if (webhookConfig?.secret) {
		const signature = c.req.header("mux-signature") ?? null;
		const isValid = await verifyWebhookSignature(rawBody, signature, webhookConfig.secret);

		if (!isValid) {
			console.error("Invalid webhook signature for environment:", muxEnvironmentId);
			return c.json({ error: "Invalid signature" }, 401);
		}
		
		console.log(`Webhook verified for library: ${webhookConfig.libraryId}`);
	} else {
		console.warn(
			"No webhook secret configured for environment:", 
			muxEnvironmentId ?? "unknown",
			"- skipping signature verification"
		);
	}

	const { type, data } = payload;

	console.log(`Received Mux webhook: ${type}`, { 
		eventId: payload.id,
		environment: muxEnvironmentId,
	});

	let result: { success: boolean; message: string };

	switch (type) {
		case "video.upload.asset_created":
			result = await handleUploadAssetCreated(db, data as unknown as MuxUploadData);
			break;

		case "video.asset.ready":
			result = await handleAssetReady(db, data as unknown as MuxAssetData);
			break;

		case "video.asset.errored":
			result = await handleAssetErrored(db, data as unknown as MuxAssetData);
			break;

		case "video.asset.updated":
			result = await handleAssetUpdated(db, data as unknown as MuxAssetData);
			break;

		case "video.asset.deleted":
			result = await handleAssetDeleted(db, data as unknown as MuxAssetData);
			break;

		default:
			// Log unhandled events for debugging
			console.log(`Unhandled webhook event type: ${type}`);
			result = { success: true, message: `Event ${type} acknowledged but not processed` };
	}

	console.log(`Webhook ${type} processed:`, result);

	// Always return 200 to acknowledge receipt
	// Mux will retry on non-2xx responses
	return c.json(result, 200);
});
