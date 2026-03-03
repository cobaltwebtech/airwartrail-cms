import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { t, protectedProcedure } from "@/worker/trpc/trpc-init";
import { auth } from "@/lib/auth-server";

// ============================================================================
// Types
// ============================================================================

type Permissions = Record<string, string[]>;
type Metadata = Record<string, unknown>;

// Helper to safely parse JSON fields that may already be objects
function parseJsonField<T>(value: string | T | null | undefined): T | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'string') {
		try {
			return JSON.parse(value) as T;
		} catch {
			return null;
		}
	}
	return value as T;
}

// ============================================================================
// Schemas
// ============================================================================

const createApiKeySchema = z.object({
	name: z.string().min(1).max(100),
	expiresIn: z.number().optional(),
	configId: z.string().optional(),
	permissions: z.record(z.string(), z.array(z.string())).optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateApiKeySchema = z.object({
	keyId: z.string(),
	name: z.string().min(1).max(100).optional(),
	enabled: z.boolean().optional(),
	permissions: z.record(z.string(), z.array(z.string())).optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

const deleteApiKeySchema = z.object({
	keyId: z.string(),
});

const getApiKeySchema = z.object({
	keyId: z.string(),
});

const listApiKeysSchema = z.object({
	configId: z.string().optional(),
	limit: z.number().optional(),
	offset: z.number().optional(),
});

// ============================================================================
// API Key Router
// ============================================================================

export const apiKeysRouter = t.router({
	/**
	 * List all API keys for the current user
	 */
	list: protectedProcedure
		.input(listApiKeysSchema)
		.query(async ({ ctx, input }) => {
			try {
				const response = await auth.api.listApiKeys({
					query: {
						configId: input.configId,
						limit: input.limit,
						offset: input.offset,
					},
					headers: ctx.headers,
				});

				return {
					apiKeys: response.apiKeys.map((key) => ({
						id: key.id,
						configId: key.configId,
						referenceId: key.referenceId,
						name: key.name,
						start: key.start,
						prefix: key.prefix,
						enabled: key.enabled,
						expiresAt: key.expiresAt,
						createdAt: key.createdAt,
						updatedAt: key.updatedAt,
						lastRequest: key.lastRequest,
						requestCount: key.requestCount,
						rateLimitEnabled: key.rateLimitEnabled,
						rateLimitMax: key.rateLimitMax,
						rateLimitTimeWindow: key.rateLimitTimeWindow,
						permissions: parseJsonField<Permissions>(key.permissions),
						metadata: parseJsonField<Metadata>(key.metadata),
					})),
					total: response.total,
					limit: response.limit,
					offset: response.offset,
				};
			} catch (error) {
				console.error("Error listing API keys:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to list API keys",
				});
			}
		}),

	/**
	 * Get a specific API key by ID
	 */
	get: protectedProcedure
		.input(getApiKeySchema)
		.query(async ({ ctx, input }) => {
			try {
				const apiKey = await auth.api.getApiKey({
					query: { id: input.keyId },
					headers: ctx.headers,
				});

				return {
					id: apiKey.id,
					configId: apiKey.configId,
					referenceId: apiKey.referenceId,
					name: apiKey.name,
					start: apiKey.start,
					prefix: apiKey.prefix,
					enabled: apiKey.enabled,
					expiresAt: apiKey.expiresAt,
					createdAt: apiKey.createdAt,
					updatedAt: apiKey.updatedAt,
					lastRequest: apiKey.lastRequest,
					requestCount: apiKey.requestCount,
					rateLimitEnabled: apiKey.rateLimitEnabled,
					rateLimitMax: apiKey.rateLimitMax,
					rateLimitTimeWindow: apiKey.rateLimitTimeWindow,
					remaining: apiKey.remaining,
					refillInterval: apiKey.refillInterval,
					refillAmount: apiKey.refillAmount,
					lastRefillAt: apiKey.lastRefillAt,
					permissions: parseJsonField<Permissions>(apiKey.permissions),
					metadata: parseJsonField<Metadata>(apiKey.metadata),
				};
			} catch (error) {
				console.error("Error getting API key:", error);
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "API key not found",
				});
			}
		}),

	/**
	 * Create a new API key
	 * Returns the full key value only once - it cannot be retrieved later
	 */
	create: protectedProcedure
		.input(createApiKeySchema)
		.mutation(async ({ ctx, input }) => {
			try {
				// Use userId for server-side API call (required for server-only properties like permissions)
				const result = await auth.api.createApiKey({
					body: {
						name: input.name,
						expiresIn: input.expiresIn,
						configId: input.configId,
						prefix: "awt_",
						userId: ctx.user.id,
						permissions: input.permissions as Permissions,
						metadata: input.metadata as Metadata,
					},
				});

				return {
					id: result.id,
					configId: result.configId,
					name: result.name,
					key: result.key, // Full key - only returned on creation!
					start: result.start,
					prefix: result.prefix,
					enabled: result.enabled,
					expiresAt: result.expiresAt,
					createdAt: result.createdAt,
					permissions: parseJsonField<Permissions>(result.permissions),
					metadata: parseJsonField<Metadata>(result.metadata),
				};
			} catch (error) {
				console.error("Error creating API key:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create API key",
				});
			}
		}),

	/**
	 * Update an existing API key
	 */
	update: protectedProcedure
		.input(updateApiKeySchema)
		.mutation(async ({ ctx, input }) => {
			try {
				// Use userId for server-side API call (required for server-only properties)
				const result = await auth.api.updateApiKey({
					body: {
						keyId: input.keyId,
						name: input.name,
						// Server-only properties - must use userId instead of headers
						userId: ctx.user.id,
						enabled: input.enabled,
						permissions: input.permissions as Permissions,
						metadata: input.metadata as Metadata,
					},
				});

				return {
					id: result.id,
					configId: result.configId,
					referenceId: result.referenceId,
					name: result.name,
					start: result.start,
					prefix: result.prefix,
					enabled: result.enabled,
					expiresAt: result.expiresAt,
					createdAt: result.createdAt,
					updatedAt: result.updatedAt,
					permissions: parseJsonField<Permissions>(result.permissions),
					metadata: parseJsonField<Metadata>(result.metadata),
				};
			} catch (error) {
				console.error("Error updating API key:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update API key",
				});
			}
		}),

	/**
	 * Delete an API key
	 */
	delete: protectedProcedure
		.input(deleteApiKeySchema)
		.mutation(async ({ ctx, input }) => {
			try {
				await auth.api.deleteApiKey({
					body: { keyId: input.keyId },
					headers: ctx.headers,
				});

				return { success: true };
			} catch (error) {
				console.error("Error deleting API key:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete API key",
				});
			}
		}),

	/**
	 * Get available permission options
	 * This returns the permission structure that can be assigned to API keys
	 */
	getPermissionOptions: protectedProcedure.query(() => {
		return {
			resources: {
				mux: {
					label: "Videos",
					description: "Access to video management API",
					actions: [
						{ id: "read", label: "Read", description: "View videos and metadata" },
						{ id: "write", label: "Write", description: "Create and update videos" },
						{ id: "delete", label: "Delete", description: "Delete videos" },
					],
				},
				playlists: {
					label: "Video Playlists",
					description: "Access to playlist management API",
					actions: [
						{ id: "read", label: "Read", description: "View playlists" },
						{ id: "write", label: "Write", description: "Create and update playlists" },
						{ id: "delete", label: "Delete", description: "Delete playlists" },
					],
				},
				libraries: {
					label: "Video Libraries",
					description: "Access to video library API",
					actions: [
						{ id: "read", label: "Read", description: "View library settings" },
						{ id: "write", label: "Write", description: "Update library settings" },
					],
				},
				blog: {
					label: "Blog",
					description: "Access to blog management API",
					actions: [
						{ id: "read", label: "Read", description: "View blog posts" },
						{ id: "write", label: "Write", description: "Create and update blog posts" },
						{ id: "delete", label: "Delete", description: "Delete blog posts" },
					],
				},
				images: {
					label: "Images & Albums",
					description: "Access to image management API",
					actions: [
						{ id: "read", label: "Read", description: "Read images and albums" },
						{ id: "write", label: "Write", description: "Create and update images and albums" },
						{ id: "delete", label: "Delete", description: "Delete images and albums" },
					],
				},
				documents: {
					label: "Documents",
					description: "Access to document management API",
					actions: [
						{ id: "read", label: "Read", description: "Read documents" },
						{ id: "write", label: "Write", description: "Create and update documents" },
						{ id: "delete", label: "Delete", description: "Delete documents" },
					],
				},
			},
		};
	}),
});
