import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { t, publicProcedure, protectedProcedure } from "../trpc-init";

// ============================================================================
// Types & Constants
// ============================================================================

type VideoStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface Video {
	id: string;
	guid?: string;
	title: string;
	thumbnail: string;
	thumbnailFileName?: string;
	collectionId?: string;
	duration: number;
	status: VideoStatus;
	views: number;
	storageSize: number;
	statusText: string;
	dateUploaded: string;
	captions?: { label: string; srclang: string }[];
	chapters?: { title: string; start: number; end: number }[];
	moments?: { label: string; timestamp: number }[];
}

interface Collection {
	videoLibraryId: number;
	guid: string;
	name: string;
	videoCount: number;
	totalSize: number;
	previewVideoIds: string;
	previewImageUrls: string[];
}

// Bunny Stream video status numbers referenced to text values
const statusMap: Record<VideoStatus, string> = {
	0: "Created",
	1: "Uploaded",
	2: "Processing",
	3: "Transcoding",
	4: "Finished",
	5: "Error",
	6: "UploadFailed",
	7: "JitSegmenting",
	8: "JitPlaylistsCreated",
};

// ============================================================================
// Helper Functions
// ============================================================================

function getThumbnailUrl(
	video: { guid?: string; thumbnailFileName?: string },
	bunnyCdn: string,
): string {
	if (video.thumbnailFileName && video.guid) {
		return `https://${bunnyCdn}/${video.guid}/${video.thumbnailFileName}`;
	}
	return "/placeholder.svg?height=720&width=1280";
}

interface BunnyApiResponseItem {
	guid?: string;
	id: string;
	title: string;
	length?: number;
	status: number;
	views: number;
	storageSize: number;
	dateUploaded?: string;
	collectionId?: string;
	thumbnailFileName?: string;
	captions?: { label: string; srclang: string }[];
	chapters?: { title: string; start: number; end: number }[];
	moments?: { label: string; timestamp: number }[];
}

interface BunnyApiResponse {
	items?: BunnyApiResponseItem[];
	videos?: BunnyApiResponseItem[];
}

// ============================================================================
// Router
// ============================================================================

export const bunnyRouter = t.router({
	/**
	 * Get all videos from the Bunny.net Stream library
	 */
	getAllVideos: publicProcedure.query(async ({ ctx }): Promise<Video[]> => {
		const { env } = ctx;
		const libraryId = env.PUBLIC_BUNNY_LIBRARY_ID;
		const apiKey = env.BUNNY_API_KEY;
		const bunnyCdn = env.PUBLIC_BUNNY_STREAM_CDN;

		try {
			const response = await fetch(
				`https://video.bunnycdn.com/library/${libraryId}/videos`,
				{
					headers: {
						AccessKey: apiKey,
						"Content-Type": "application/json",
					},
				},
			);

			if (!response.ok) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Failed to fetch videos: ${response.statusText}`,
				});
			}

			const data: BunnyApiResponse = await response.json();

			const mapVideoResponse = (video: BunnyApiResponseItem): Video => ({
				id: video.guid || video.id,
				guid: video.guid,
				title: video.title,
				thumbnail: getThumbnailUrl(video, bunnyCdn),
				duration: video.length || 0,
				status: video.status as VideoStatus,
				views: video.views || 0,
				storageSize: video.storageSize || 0,
				statusText: statusMap[video.status as VideoStatus] || "Unknown",
				dateUploaded: video.dateUploaded || new Date().toISOString(),
				collectionId: video.collectionId || "",
				captions: video.captions || [],
				chapters: video.chapters || [],
			});

			if (Array.isArray(data)) {
				return data.map(mapVideoResponse);
			}
			if (data.items && Array.isArray(data.items)) {
				return data.items.map(mapVideoResponse);
			}
			if (data.videos && Array.isArray(data.videos)) {
				return data.videos.map(mapVideoResponse);
			}

			console.error("Unexpected API response structure:", data);
			return [];
		} catch (error) {
			if (error instanceof TRPCError) throw error;
			console.error("Error fetching videos:", error);
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to fetch videos from Bunny.net",
			});
		}
	}),

	/**
	 * Get a single video by ID
	 */
	getVideo: publicProcedure
		.input(z.object({ videoId: z.string() }))
		.query(async ({ ctx, input }): Promise<Video> => {
			const { env } = ctx;
			const libraryId = env.PUBLIC_BUNNY_LIBRARY_ID;
			const apiKey = env.BUNNY_API_KEY;
			const bunnyCdn = env.PUBLIC_BUNNY_STREAM_CDN;

			try {
				const response = await fetch(
					`https://video.bunnycdn.com/library/${libraryId}/videos/${input.videoId}`,
					{
						headers: {
							AccessKey: apiKey,
							"Content-Type": "application/json",
						},
					},
				);

				if (!response.ok) {
					if (response.status === 404) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: `Video ${input.videoId} not found`,
						});
					}
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: `Failed to fetch video: ${response.statusText}`,
					});
				}

				const video: BunnyApiResponseItem = await response.json();

				return {
					id: video.guid || video.id,
					guid: video.guid,
					title: video.title,
					thumbnail: getThumbnailUrl(video, bunnyCdn),
					duration: video.length || 0,
					views: video.views || 0,
					storageSize: video.storageSize || 0,
					status: video.status as VideoStatus,
					statusText: statusMap[video.status as VideoStatus] || "Unknown",
					dateUploaded: video.dateUploaded || new Date().toISOString(),
					collectionId: video.collectionId || "",
					captions: video.captions || [],
					chapters: video.chapters || [],
					moments: video.moments || [],
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error fetching video:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch video from Bunny.net",
				});
			}
		}),

	/**
	 * Generate a signed URL token for secure video playback
	 */
	getVideoToken: publicProcedure
		.input(z.object({ videoId: z.string() }))
		.query(async ({ ctx, input }): Promise<{ url: string }> => {
			const { env } = ctx;
			const libraryId = env.PUBLIC_BUNNY_LIBRARY_ID;
			const bunnyToken = env.BUNNY_STREAM_TOKEN;

			if (!bunnyToken) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "BUNNY_STREAM_TOKEN is not configured",
				});
			}

			// Set expiration 3 hours from now
			const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 3;

			// Generate token using Web Crypto API (Cloudflare Workers compatible)
			const toHash = `${bunnyToken}${input.videoId}${expires}`;
			const encoder = new TextEncoder();
			const data = encoder.encode(toHash);
			const hashBuffer = await crypto.subtle.digest("SHA-256", data);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			const token = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

			// Construct signed URL
			const signedUrl = `https://player.mediadelivery.net/embed/${libraryId}/${input.videoId}?token=${token}&expires=${expires}&autoplay=false&loop=false&muted=false&preload=true&responsive=true`;

			return { url: signedUrl };
		}),

	/**
	 * Get all collections from the Bunny.net Stream library
	 */
	getCollections: publicProcedure
		.input(
			z
				.object({
					page: z.number().min(1).default(1),
					perPage: z.number().min(1).max(100).default(50),
				})
				.optional(),
		)
		.query(async ({ ctx, input }): Promise<Collection[]> => {
			const { env } = ctx;
			const libraryId = env.PUBLIC_BUNNY_LIBRARY_ID;
			const apiKey = env.BUNNY_API_KEY;
			const page = input?.page ?? 1;
			const perPage = input?.perPage ?? 50;

			try {
				const response = await fetch(
					`https://video.bunnycdn.com/library/${libraryId}/collections?page=${page}&perPage=${perPage}`,
					{
						headers: {
							AccessKey: apiKey,
							"Content-Type": "application/json",
						},
					},
				);

				if (!response.ok) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: `Failed to fetch collections: ${response.statusText}`,
					});
				}

				const data = (await response.json()) as {
					items?: {
						videoLibraryId: number;
						guid: string;
						name: string;
						videoCount: number;
						totalSize: number;
						previewVideoIds: string;
						previewImageUrls: string[];
					}[];
				};

				if (data.items && Array.isArray(data.items)) {
					return data.items.map(
						(item: {
							videoLibraryId: number;
							guid: string;
							name: string;
							videoCount: number;
							totalSize: number;
							previewVideoIds: string;
							previewImageUrls: string[];
						}): Collection => ({
							videoLibraryId: item.videoLibraryId,
							guid: item.guid,
							name: item.name,
							videoCount: item.videoCount,
							totalSize: item.totalSize,
							previewVideoIds: item.previewVideoIds,
							previewImageUrls: item.previewImageUrls,
						}),
					);
				}

				console.error("Unexpected API response structure:", data);
				return [];
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error fetching collections:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch collections from Bunny.net",
				});
			}
		}),

	/**
	 * Create a new video entry (returns upload URL)
	 * Protected: requires authentication
	 */
	createVideo: protectedProcedure
		.input(
			z.object({
				title: z.string().min(1),
				collectionId: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const libraryId = env.PUBLIC_BUNNY_LIBRARY_ID;
			const apiKey = env.BUNNY_API_KEY;

			try {
				const response = await fetch(
					`https://video.bunnycdn.com/library/${libraryId}/videos`,
					{
						method: "POST",
						headers: {
							AccessKey: apiKey,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							title: input.title,
							collectionId: input.collectionId,
						}),
					},
				);

				if (!response.ok) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: `Failed to create video: ${response.statusText}`,
					});
				}

				const video = (await response.json()) as { guid: string };

				return {
					videoId: video.guid,
					libraryId,
					// TUS upload endpoint for resumable uploads
					uploadUrl: `https://video.bunnycdn.com/tusupload`,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error creating video:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create video on Bunny.net",
				});
			}
		}),

	/**
	 * Update video metadata
	 * Protected: requires authentication
	 */
	updateVideo: protectedProcedure
		.input(
			z.object({
				videoId: z.string(),
				title: z.string().min(1).optional(),
				collectionId: z.string().optional(),
				chapters: z
					.array(
						z.object({
							title: z.string(),
							start: z.number(),
							end: z.number(),
						}),
					)
					.optional(),
				moments: z
					.array(
						z.object({
							label: z.string(),
							timestamp: z.number(),
						}),
					)
					.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const libraryId = env.PUBLIC_BUNNY_LIBRARY_ID;
			const apiKey = env.BUNNY_API_KEY;

			const { videoId, ...updateData } = input;

			try {
				const response = await fetch(
					`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
					{
						method: "POST",
						headers: {
							AccessKey: apiKey,
							"Content-Type": "application/json",
						},
						body: JSON.stringify(updateData),
					},
				);

				if (!response.ok) {
					if (response.status === 404) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: `Video ${videoId} not found`,
						});
					}
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: `Failed to update video: ${response.statusText}`,
					});
				}

				return { success: true, videoId };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error updating video:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update video on Bunny.net",
				});
			}
		}),

	/**
	 * Delete a video
	 * Protected: requires authentication
	 */
	deleteVideo: protectedProcedure
		.input(z.object({ videoId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const libraryId = env.PUBLIC_BUNNY_LIBRARY_ID;
			const apiKey = env.BUNNY_API_KEY;

			try {
				const response = await fetch(
					`https://video.bunnycdn.com/library/${libraryId}/videos/${input.videoId}`,
					{
						method: "DELETE",
						headers: {
							AccessKey: apiKey,
							"Content-Type": "application/json",
						},
					},
				);

				if (!response.ok) {
					if (response.status === 404) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: `Video ${input.videoId} not found`,
						});
					}
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: `Failed to delete video: ${response.statusText}`,
					});
				}

				return { success: true, videoId: input.videoId };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error deleting video:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete video on Bunny.net",
				});
			}
		}),

	/**
	 * Create a new collection
	 * Protected: requires authentication
	 */
	createCollection: protectedProcedure
		.input(z.object({ name: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const libraryId = env.PUBLIC_BUNNY_LIBRARY_ID;
			const apiKey = env.BUNNY_API_KEY;

			try {
				const response = await fetch(
					`https://video.bunnycdn.com/library/${libraryId}/collections`,
					{
						method: "POST",
						headers: {
							AccessKey: apiKey,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({ name: input.name }),
					},
				);

				if (!response.ok) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: `Failed to create collection: ${response.statusText}`,
					});
				}

				const collection = (await response.json()) as { guid: string; name: string };

				return {
					guid: collection.guid,
					name: collection.name,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error creating collection:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create collection on Bunny.net",
				});
			}
		}),

	/**
	 * Delete a collection
	 * Protected: requires authentication
	 */
	deleteCollection: protectedProcedure
		.input(z.object({ collectionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const libraryId = env.PUBLIC_BUNNY_LIBRARY_ID;
			const apiKey = env.BUNNY_API_KEY;

			try {
				const response = await fetch(
					`https://video.bunnycdn.com/library/${libraryId}/collections/${input.collectionId}`,
					{
						method: "DELETE",
						headers: {
							AccessKey: apiKey,
							"Content-Type": "application/json",
						},
					},
				);

				if (!response.ok) {
					if (response.status === 404) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: `Collection ${input.collectionId} not found`,
						});
					}
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: `Failed to delete collection: ${response.statusText}`,
					});
				}

				return { success: true, collectionId: input.collectionId };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error deleting collection:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete collection on Bunny.net",
				});
			}
		}),

	/**
	 * Update collection name
	 * Protected: requires authentication
	 */
	updateCollection: protectedProcedure
		.input(
			z.object({
				collectionId: z.string(),
				name: z.string().min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const libraryId = env.PUBLIC_BUNNY_LIBRARY_ID;
			const apiKey = env.BUNNY_API_KEY;

			try {
				const response = await fetch(
					`https://video.bunnycdn.com/library/${libraryId}/collections/${input.collectionId}`,
					{
						method: "POST",
						headers: {
							AccessKey: apiKey,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({ name: input.name }),
					},
				);

				if (!response.ok) {
					if (response.status === 404) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: `Collection ${input.collectionId} not found`,
						});
					}
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: `Failed to update collection: ${response.statusText}`,
					});
				}

				return { success: true, collectionId: input.collectionId, name: input.name };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error updating collection:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update collection on Bunny.net",
				});
			}
		}),

	/**
	 * Add caption to a video
	 * Protected: requires authentication
	 */
	addCaption: protectedProcedure
		.input(
			z.object({
				videoId: z.string(),
				srclang: z.string().min(2).max(5), // e.g., "en", "es", "fr"
				label: z.string().min(1), // e.g., "English", "Spanish"
				captionsFile: z.string(), // Base64 encoded or URL
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const libraryId = env.PUBLIC_BUNNY_LIBRARY_ID;
			const apiKey = env.BUNNY_API_KEY;

			try {
				const response = await fetch(
					`https://video.bunnycdn.com/library/${libraryId}/videos/${input.videoId}/captions/${input.srclang}`,
					{
						method: "POST",
						headers: {
							AccessKey: apiKey,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							srclang: input.srclang,
							label: input.label,
							captionsFile: input.captionsFile,
						}),
					},
				);

				if (!response.ok) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: `Failed to add caption: ${response.statusText}`,
					});
				}

				return { success: true, videoId: input.videoId, srclang: input.srclang };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error adding caption:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to add caption on Bunny.net",
				});
			}
		}),

	/**
	 * Delete caption from a video
	 * Protected: requires authentication
	 */
	deleteCaption: protectedProcedure
		.input(
			z.object({
				videoId: z.string(),
				srclang: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const libraryId = env.PUBLIC_BUNNY_LIBRARY_ID;
			const apiKey = env.BUNNY_API_KEY;

			try {
				const response = await fetch(
					`https://video.bunnycdn.com/library/${libraryId}/videos/${input.videoId}/captions/${input.srclang}`,
					{
						method: "DELETE",
						headers: {
							AccessKey: apiKey,
							"Content-Type": "application/json",
						},
					},
				);

				if (!response.ok) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: `Failed to delete caption: ${response.statusText}`,
					});
				}

				return { success: true, videoId: input.videoId, srclang: input.srclang };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error deleting caption:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete caption on Bunny.net",
				});
			}
		}),

	/**
	 * Set thumbnail for a video
	 * Protected: requires authentication
	 */
	setThumbnail: protectedProcedure
		.input(
			z.object({
				videoId: z.string(),
				thumbnailUrl: z.string().url().optional(),
				// Alternatively, set thumbnail from a specific time in the video
				thumbnailTime: z.number().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const libraryId = env.PUBLIC_BUNNY_LIBRARY_ID;
			const apiKey = env.BUNNY_API_KEY;

			try {
				// If thumbnailTime is provided, use the reencode endpoint
				if (input.thumbnailTime !== undefined) {
					const response = await fetch(
						`https://video.bunnycdn.com/library/${libraryId}/videos/${input.videoId}/thumbnail?thumbnailUrl=${input.thumbnailTime}`,
						{
							method: "POST",
							headers: {
								AccessKey: apiKey,
								"Content-Type": "application/json",
							},
						},
					);

					if (!response.ok) {
						throw new TRPCError({
							code: "INTERNAL_SERVER_ERROR",
							message: `Failed to set thumbnail: ${response.statusText}`,
						});
					}
				} else if (input.thumbnailUrl) {
					// Upload custom thumbnail from URL
					const response = await fetch(
						`https://video.bunnycdn.com/library/${libraryId}/videos/${input.videoId}/thumbnail?thumbnailUrl=${encodeURIComponent(input.thumbnailUrl)}`,
						{
							method: "POST",
							headers: {
								AccessKey: apiKey,
								"Content-Type": "application/json",
							},
						},
					);

					if (!response.ok) {
						throw new TRPCError({
							code: "INTERNAL_SERVER_ERROR",
							message: `Failed to set thumbnail: ${response.statusText}`,
						});
					}
				}

				return { success: true, videoId: input.videoId };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error setting thumbnail:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to set thumbnail on Bunny.net",
				});
			}
		}),
});
