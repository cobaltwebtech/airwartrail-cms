import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { video, muxLibrary, videoTrack } from "@/db/video-schema";
import { generateVideoId } from "@/worker/lib/generate-id";
import { decrypt } from "@/worker/lib/encryption";
import { generateTrackId} from "@/worker/lib/generate-id";

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
	created_at?: string;
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

interface MuxTrackData {
	id: string;
	type: "video" | "audio" | "text";
	text_type?: "subtitles";
	text_source?: "uploaded" | "embedded" | "generated_vod" | "generated_live" | "generated_live_final";
	language_code?: string;
	name?: string;
	status?: "preparing" | "ready" | "errored" | "deleted";
	closed_captions?: boolean;
	passthrough?: string;
	max_width?: number;
	max_height?: number;
	max_frame_rate?: number;
	duration?: number;
	max_channels?: number;
	max_channel_layout?: string;
	asset_id: string;
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
 * Handle video.upload.created event
 * 
 * This event fires when a direct upload URL is created (before the file is uploaded).
 * We log this for monitoring but don't create database records yet - we wait for
 * asset_created to avoid orphaned records from abandoned uploads.
 * 
 * @see https://docs.mux.com/guides/direct-upload#monitor-upload-status
 */
async function handleUploadCreated(
	_db: ReturnType<typeof getVideosDb>,
	data: MuxUploadData,
): Promise<{ success: boolean; message: string }> {
	const { id: uploadId, timeout, cors_origin, new_asset_settings } = data;

	console.log(`Upload created: ${uploadId}`, {
		timeout,
		corsOrigin: cors_origin,
		videoQuality: new_asset_settings?.video_quality,
		title: new_asset_settings?.meta?.title,
	});

	// We intentionally don't create a database record here.
	// If the upload is abandoned (user refreshes, goes back, etc.),
	// it will automatically time out on Mux's side without leaving
	// orphaned records in our database.

	return {
		success: true,
		message: `Upload ${uploadId} created and waiting for file`,
	};
}

/**
 * Handle video.upload.cancelled event
 * 
 * This event fires when an upload is explicitly cancelled.
 */
async function handleUploadCancelled(
	db: ReturnType<typeof getVideosDb>,
	data: MuxUploadData,
): Promise<{ success: boolean; message: string }> {
	const { id: uploadId } = data;

	console.log(`Upload cancelled: ${uploadId}`);

	// Check if we have any video record with this upload ID (shouldn't normally exist)
	const existingVideo = await db
		.select({ id: video.id })
		.from(video)
		.where(eq(video.muxUploadId, uploadId))
		.limit(1);

	if (existingVideo.length > 0) {
		// Mark as errored if somehow a record exists
		await db
			.update(video)
			.set({
				status: "errored",
				errorCategory: "upload_cancelled",
				errorMessages: JSON.stringify(["Upload was cancelled"]),
				updatedAt: new Date(),
			})
			.where(eq(video.muxUploadId, uploadId));

		return {
			success: true,
			message: `Upload ${uploadId} cancelled, marked video ${existingVideo[0].id} as errored`,
		};
	}

	return {
		success: true,
		message: `Upload ${uploadId} cancelled (no database record to update)`,
	};
}

/**
 * Handle video.upload.errored event
 * 
 * This event fires when an upload fails due to an error.
 */
async function handleUploadErrored(
	db: ReturnType<typeof getVideosDb>,
	data: MuxUploadData,
): Promise<{ success: boolean; message: string }> {
	const { id: uploadId, error } = data;

	console.log(`Upload errored: ${uploadId}`, error);

	// Check if we have any video record with this upload ID
	const existingVideo = await db
		.select({ id: video.id })
		.from(video)
		.where(eq(video.muxUploadId, uploadId))
		.limit(1);

	if (existingVideo.length > 0) {
		await db
			.update(video)
			.set({
				status: "errored",
				errorCategory: error?.type ?? "upload_error",
				errorMessages: JSON.stringify([error?.message ?? "Upload failed"]),
				updatedAt: new Date(),
			})
			.where(eq(video.muxUploadId, uploadId));

		return {
			success: true,
			message: `Upload ${uploadId} errored, marked video ${existingVideo[0].id} as errored`,
		};
	}

	return {
		success: true,
		message: `Upload ${uploadId} errored: ${error?.message ?? "unknown error"}`,
	};
}

/**
 * Handle video.upload.timed_out event
 * 
 * This event fires when an upload times out (default: 1 hour).
 * This is the normal outcome for abandoned uploads.
 */
async function handleUploadTimedOut(
	db: ReturnType<typeof getVideosDb>,
	data: MuxUploadData,
): Promise<{ success: boolean; message: string }> {
	const { id: uploadId, timeout } = data;

	console.log(`Upload timed out: ${uploadId} (timeout: ${timeout}s)`);

	// Check if we have any video record with this upload ID
	const existingVideo = await db
		.select({ id: video.id })
		.from(video)
		.where(eq(video.muxUploadId, uploadId))
		.limit(1);

	if (existingVideo.length > 0) {
		await db
			.update(video)
			.set({
				status: "errored",
				errorCategory: "upload_timed_out",
				errorMessages: JSON.stringify(["Upload timed out - file was not uploaded in time"]),
				updatedAt: new Date(),
			})
			.where(eq(video.muxUploadId, uploadId));

		return {
			success: true,
			message: `Upload ${uploadId} timed out, marked video ${existingVideo[0].id} as errored`,
		};
	}

	// This is the normal case for abandoned uploads - no action needed
	return {
		success: true,
		message: `Upload ${uploadId} timed out (abandoned upload, no cleanup needed)`,
	};
}

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
		.select({ id: video.id, status: video.status })
		.from(video)
		.where(eq(video.muxUploadId, uploadId))
		.limit(1);

	if (existingByUpload.length > 0) {
		// Only update status to "preparing" if video isn't already in a terminal state
		// This prevents webhook retries from overwriting "ready" or "errored" status
		const currentStatus = existingByUpload[0].status;
		const isTerminalStatus = currentStatus === "ready" || currentStatus === "errored";
		
		await db
			.update(video)
			.set({
				muxAssetId: assetId,
				...(isTerminalStatus ? {} : { status: "preparing" }),
				updatedAt: new Date(),
			})
			.where(eq(video.muxUploadId, uploadId));

		return { 
			success: true, 
			message: isTerminalStatus 
				? `Video ${existingByUpload[0].id} already ${currentStatus}, only updated asset ID`
				: `Updated video ${existingByUpload[0].id} with asset ID ${assetId}` 
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
 * Handle video.asset.created event
 * 
 * This event fires when a new asset is created in Mux.
 * This happens before the asset is fully processed (before asset.ready).
 * We log this for monitoring but typically wait for asset.ready to create records.
 */
async function handleAssetCreated(
	_db: ReturnType<typeof getVideosDb>,
	data: MuxAssetData,
): Promise<{ success: boolean; message: string }> {
	const { id: assetId, upload_id, meta, status } = data;

	console.log(`Asset created: ${assetId}`, {
		uploadId: upload_id,
		status,
		title: meta?.title,
	});

	// We intentionally don't create a database record here.
	// We wait for asset.ready to ensure the video is fully processed.
	// If we created records here, we might have incomplete metadata.

	return {
		success: true,
		message: `Asset ${assetId} created with status "${status}", waiting for asset.ready`,
	};
}

/**
 * Handle video.asset.non_standard_input_detected event
 * 
 * This event fires when Mux detects non-standard input in the uploaded video.
 * This is informational - the video will still be processed but may have
 * suboptimal quality or compatibility.
 * 
 * @see https://docs.mux.com/guides/video-quality#non-standard-inputs
 */
async function handleNonStandardInputDetected(
	db: ReturnType<typeof getVideosDb>,
	data: MuxAssetData,
): Promise<{ success: boolean; message: string }> {
	const { id: assetId } = data;

	console.log(`Non-standard input detected for asset: ${assetId}`);

	// Try to find the video and add a note about non-standard input
	// This is optional - we're just logging for now
	const existingVideo = await db
		.select({ id: video.id })
		.from(video)
		.where(eq(video.muxAssetId, assetId))
		.limit(1);

	if (existingVideo.length > 0) {
		// Could optionally store this info in a metadata field if needed
		console.log(`Video ${existingVideo[0].id} has non-standard input`);
	}

	return {
		success: true,
		message: `Non-standard input detected for asset ${assetId}. Video will still process but may have suboptimal quality.`,
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
		resolution_tier,
		video_quality,
		upload_id,
		ingest_type,
		meta,
		test,
		tracks,
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

	// Get dimensions from video track (max_stored_resolution is deprecated)
	const videoTrackData = tracks?.find((t) => t.type === "video");
	const maxWidth = videoTrackData?.max_width ?? null;
	const maxHeight = videoTrackData?.max_height ?? null;
	const maxFrameRate = videoTrackData?.max_frame_rate ?? null;

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
				maxFrameRate,
				resolutionTier: resolution_tier as "audio-only" | "720p" | "1080p" | "1440p" | "2160p" | null,
				videoQuality: video_quality as "basic" | "plus" | "premium" | null,
				playbackPolicy: playbackPolicy as "public" | "signed",
				ingestCategory: ingest_type as "on_demand_url" | "on_demand_direct_upload" | "on_demand_clip" | "live_rtmp" | "live_srt" | null,
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
		maxFrameRate,
		resolutionTier: resolution_tier as "audio-only" | "720p" | "1080p" | "1440p" | "2160p" | null,
		videoQuality: (video_quality as "basic" | "plus" | "premium") ?? defaultLibrary[0].defaultVideoQuality,
		playbackPolicy: playbackPolicy as "public" | "signed",
		passthrough: newVideoId,
		externalId: newVideoId,
		ingestCategory: ingest_type as "on_demand_url" | "on_demand_direct_upload" | "on_demand_clip" | "live_rtmp" | "live_srt" | null,
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
				errorCategory: errors?.type ?? "unknown",
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

	// Extract resolution and frame rate from video track (max_stored_* fields are deprecated)
	const videoTrackData = tracks?.find((t) => t.type === "video");
	const maxWidth = videoTrackData?.max_width ?? null;
	const maxHeight = videoTrackData?.max_height ?? null;
	const maxFrameRate = videoTrackData?.max_frame_rate ?? null;

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
	if (maxFrameRate !== null) updateData.maxFrameRate = maxFrameRate;
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

/**
 * Handle video.asset.track.ready event
 * 
 * This event fires when a track (including auto-generated captions) is ready.
 * We use this to store track information in our database.
 * 
 * @see https://docs.mux.com/guides/add-autogenerated-captions
 */
async function handleTrackReady(
	db: ReturnType<typeof getVideosDb>,
	data: MuxTrackData,
): Promise<{ success: boolean; message: string }> {
	const {
		id: muxTrackId,
		type,
		text_type,
		text_source,
		language_code,
		name,
		closed_captions,
		passthrough,
		asset_id: assetId,
	} = data;

	console.log(`Processing track.ready: track=${muxTrackId}, asset=${assetId}, type=${type}, text_source=${text_source}`);

	// Find the video in our database by asset ID
	const existingVideo = await db
		.select({ id: video.id })
		.from(video)
		.where(eq(video.muxAssetId, assetId))
		.limit(1);

	if (existingVideo.length === 0) {
		console.log(`No video found for asset ${assetId}, skipping track storage`);
		return {
			success: true,
			message: `Track ${muxTrackId} ready but no matching video found for asset ${assetId}`,
		};
	}

	const videoId = existingVideo[0].id;

	// Check if this track already exists in our database
	const existingTrack = await db
		.select({ id: videoTrack.id })
		.from(videoTrack)
		.where(eq(videoTrack.muxTrackId, muxTrackId))
		.limit(1);

	if (existingTrack.length > 0) {
		// Update existing track status to ready
		await db
			.update(videoTrack)
			.set({
				status: "ready",
				name: name ?? undefined,
				languageCode: language_code ?? undefined,
				updatedAt: new Date(),
			})
			.where(eq(videoTrack.muxTrackId, muxTrackId));

		return {
			success: true,
			message: `Updated track ${muxTrackId} status to ready`,
		};
	}

	// Insert new track record
	const trackId = generateTrackId();
	await db.insert(videoTrack).values({
		id: trackId,
		videoId,
		muxTrackId,
		trackCategory: type as "video" | "audio" | "text",
		textCategory: text_type as "subtitles" | undefined,
		textSource: text_source as "uploaded" | "embedded" | "generated_vod" | "generated_live" | "generated_live_final" | undefined,
		languageCode: language_code ?? null,
		name: name ?? null,
		status: "ready",
		closedCaptions: closed_captions ?? false,
		isPrimary: false,
		passthrough: passthrough ?? null,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	const isAutoGenerated = text_source === "generated_vod" || text_source === "generated_live";
	const trackDescription = isAutoGenerated ? "auto-generated caption" : `${type} track`;

	return {
		success: true,
		message: `Stored ${trackDescription} ${muxTrackId} for video ${videoId}`,
	};
}

/**
 * Handle video.asset.track.created event
 * 
 * This event fires when a track is created (but may still be processing).
 * We use this to create a "preparing" track record.
 */
async function handleTrackCreated(
	db: ReturnType<typeof getVideosDb>,
	data: MuxTrackData,
): Promise<{ success: boolean; message: string }> {
	const {
		id: muxTrackId,
		type,
		text_type,
		text_source,
		language_code,
		name,
		closed_captions,
		passthrough,
		asset_id: assetId,
	} = data;

	console.log(`Processing track.created: track=${muxTrackId}, asset=${assetId}, type=${type}, text_source=${text_source}`);

	// Find the video in our database by asset ID
	const existingVideo = await db
		.select({ id: video.id })
		.from(video)
		.where(eq(video.muxAssetId, assetId))
		.limit(1);

	if (existingVideo.length === 0) {
		console.log(`No video found for asset ${assetId}, skipping track storage`);
		return {
			success: true,
			message: `Track ${muxTrackId} created but no matching video found for asset ${assetId}`,
		};
	}

	const videoId = existingVideo[0].id;

	// Check if this track already exists
	const existingTrack = await db
		.select({ id: videoTrack.id })
		.from(videoTrack)
		.where(eq(videoTrack.muxTrackId, muxTrackId))
		.limit(1);

	if (existingTrack.length > 0) {
		return {
			success: true,
			message: `Track ${muxTrackId} already exists`,
		};
	}

	// Insert new track with "preparing" status
	const trackId = generateTrackId();
	await db.insert(videoTrack).values({
		id: trackId,
		videoId,
		muxTrackId,
		trackCategory: type as "video" | "audio" | "text",
		textCategory: text_type as "subtitles" | undefined,
		textSource: text_source as "uploaded" | "embedded" | "generated_vod" | "generated_live" | "generated_live_final" | undefined,
		languageCode: language_code ?? null,
		name: name ?? null,
		status: "preparing",
		closedCaptions: closed_captions ?? false,
		isPrimary: false,
		passthrough: passthrough ?? null,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	return {
		success: true,
		message: `Created track record ${muxTrackId} with status "preparing"`,
	};
}

/**
 * Handle video.asset.track.errored event
 * 
 * This event fires when track processing fails.
 */
async function handleTrackErrored(
	db: ReturnType<typeof getVideosDb>,
	data: MuxTrackData,
): Promise<{ success: boolean; message: string }> {
	const { id: muxTrackId, asset_id: assetId } = data;

	console.log(`Processing track.errored: track=${muxTrackId}, asset=${assetId}`);

	// Update track status if it exists
	await db
		.update(videoTrack)
		.set({
			status: "errored",
			updatedAt: new Date(),
		})
		.where(eq(videoTrack.muxTrackId, muxTrackId));

	return {
		success: true,
		message: `Track ${muxTrackId} marked as errored`,
	};
}

/**
 * Handle video.asset.track.deleted event
 * 
 * This event fires when a track is deleted.
 */
async function handleTrackDeleted(
	db: ReturnType<typeof getVideosDb>,
	data: MuxTrackData,
): Promise<{ success: boolean; message: string }> {
	const { id: muxTrackId, asset_id: assetId } = data;

	console.log(`Processing track.deleted: track=${muxTrackId}, asset=${assetId}`);

	// Update track status to deleted (soft delete)
	await db
		.update(videoTrack)
		.set({
			status: "deleted",
			updatedAt: new Date(),
		})
		.where(eq(videoTrack.muxTrackId, muxTrackId));

	return {
		success: true,
		message: `Track ${muxTrackId} marked as deleted`,
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

	try {
		switch (type) {
			case "video.upload.created":
				result = await handleUploadCreated(db, data as unknown as MuxUploadData);
				break;

			case "video.upload.cancelled":
				result = await handleUploadCancelled(db, data as unknown as MuxUploadData);
				break;

			case "video.upload.errored":
				result = await handleUploadErrored(db, data as unknown as MuxUploadData);
				break;

			case "video.upload.timed_out":
				result = await handleUploadTimedOut(db, data as unknown as MuxUploadData);
				break;

			case "video.upload.asset_created":
				result = await handleUploadAssetCreated(db, data as unknown as MuxUploadData);
				break;

			case "video.asset.created":
				result = await handleAssetCreated(db, data as unknown as MuxAssetData);
				break;

			case "video.asset.non_standard_input_detected":
				result = await handleNonStandardInputDetected(db, data as unknown as MuxAssetData);
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

			case "video.asset.track.created":
				result = await handleTrackCreated(db, data as unknown as MuxTrackData);
				break;

			case "video.asset.track.ready":
				result = await handleTrackReady(db, data as unknown as MuxTrackData);
				break;

			case "video.asset.track.errored":
				result = await handleTrackErrored(db, data as unknown as MuxTrackData);
				break;

			case "video.asset.track.deleted":
				result = await handleTrackDeleted(db, data as unknown as MuxTrackData);
				break;

			default:
				// Log unhandled events for debugging
				console.log(`Unhandled webhook event type: ${type}`);
				result = { success: true, message: `Event ${type} acknowledged but not processed` };
		}
	} catch (error) {
		// Log error but still return 200 to acknowledge receipt
		// This prevents Mux from retrying which could cause duplicate processing
		console.error(`Error processing webhook ${type}:`, error);
		result = { 
			success: false, 
			message: `Error processing ${type}: ${error instanceof Error ? error.message : "Unknown error"}` 
		};
	}

	console.log(`Webhook ${type} processed:`, result);

	// Always return 200 to acknowledge receipt
	// Mux will retry on non-2xx responses
	return c.json(result, 200);
});
