import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { t, protectedProcedure } from "../../trpc-init";
import Mux from "@mux/mux-node";
import { eq } from "drizzle-orm";
import { muxLibrary } from "@/db/video-schema";
import { generateLibraryId } from "@/worker/lib/generate-id";
import {
	getVideosDb,
	getMuxLibrary,
	encryptLibraryCredentials,
} from "./shared";

export const librariesRouter = t.router({
	/**
	 * List all available Mux libraries
	 */
	listLibraries: protectedProcedure.query(async ({ ctx }) => {
		const { env } = ctx;
		const db = getVideosDb(env);

		try {
			const libraries = await db
				.select({
					id: muxLibrary.id,
					name: muxLibrary.name,
					description: muxLibrary.description,
					defaultPlaybackPolicy: muxLibrary.defaultPlaybackPolicy,
					defaultVideoQuality: muxLibrary.defaultVideoQuality,
					isDefault: muxLibrary.isDefault,
					isActive: muxLibrary.isActive,
					createdAt: muxLibrary.createdAt,
					updatedAt: muxLibrary.updatedAt,
				})
				.from(muxLibrary)
				.where(eq(muxLibrary.isActive, true));

			return libraries;
		} catch (error) {
			if (error instanceof TRPCError) throw error;
			console.error("Error listing Mux libraries:", error);
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to list Mux libraries",
			});
		}
	}),

	/**
	 * Get a specific Mux library by ID
	 */
	getLibrary: protectedProcedure
		.input(z.object({ libraryId: z.string().optional() }))
		.query(async ({ ctx, input }) => {
			const { env } = ctx;

			try {
				const library = await getMuxLibrary(env, input.libraryId);
				// Return library with IDs (not secrets) for display
				return {
					id: library.id,
					name: library.name,
					description: library.description,
					muxEnvironmentId: library.muxEnvironmentId,
					tokenId: library.tokenId, // ID only, not the secret
					signingKeyId: library.signingKeyId, // ID only, not the private key
					webhookSecret: library.webhookSecret, // Displayed hidden, user can reveal
					defaultPlaybackPolicy: library.defaultPlaybackPolicy,
					defaultVideoQuality: library.defaultVideoQuality,
					isDefault: library.isDefault,
					isActive: library.isActive,
					hasSigningKey: !!(library.signingKeyId && library.signingKeyPrivate),
					createdAt: library.createdAt,
					updatedAt: library.updatedAt,
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error getting Mux library:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get Mux library",
				});
			}
		}),

	/**
	 * Create a new Mux library
	 */
	createLibrary: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				description: z.string().max(500).optional(),
				muxEnvironmentId: z.string().optional(),
				tokenId: z.string().min(1),
				tokenSecret: z.string().min(1),
				signingKeyId: z.string().optional(),
				signingKeyPrivate: z.string().optional(),
				webhookSecret: z.string().optional(),
				defaultPlaybackPolicy: z
					.enum(["public", "signed"])
					.default("public"),
				defaultVideoQuality: z
					.enum(["basic", "plus", "premium"])
					.default("plus"),
				isDefault: z.boolean().default(false),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);

			try {
				const id = generateLibraryId();

				// If this is set as default, unset any existing default
				if (input.isDefault) {
					await db
						.update(muxLibrary)
						.set({ isDefault: false })
						.where(eq(muxLibrary.isDefault, true));
				}

				// Encrypt sensitive credentials before storing
				const encryptedCredentials = await encryptLibraryCredentials(
					{
						tokenId: input.tokenId,
						tokenSecret: input.tokenSecret,
						signingKeyId: input.signingKeyId,
						signingKeyPrivate: input.signingKeyPrivate,
						webhookSecret: input.webhookSecret,
					},
					env,
				);

				const [newLibrary] = await db
					.insert(muxLibrary)
					.values({
						id,
						name: input.name,
						description: input.description,
						muxEnvironmentId: input.muxEnvironmentId,
						tokenId: encryptedCredentials.tokenId,
						tokenSecret: encryptedCredentials.tokenSecret,
						signingKeyId: encryptedCredentials.signingKeyId,
						signingKeyPrivate: encryptedCredentials.signingKeyPrivate,
						webhookSecret: encryptedCredentials.webhookSecret,
						defaultPlaybackPolicy: input.defaultPlaybackPolicy,
						defaultVideoQuality: input.defaultVideoQuality,
						isDefault: input.isDefault,
						isActive: true,
					})
					.returning({
						id: muxLibrary.id,
						name: muxLibrary.name,
						description: muxLibrary.description,
						defaultPlaybackPolicy: muxLibrary.defaultPlaybackPolicy,
						defaultVideoQuality: muxLibrary.defaultVideoQuality,
						isDefault: muxLibrary.isDefault,
						isActive: muxLibrary.isActive,
						createdAt: muxLibrary.createdAt,
						updatedAt: muxLibrary.updatedAt,
					});

				return newLibrary;
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error creating Mux library:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create Mux library",
				});
			}
		}),

	/**
	 * Update a Mux library
	 */
	updateLibrary: protectedProcedure
		.input(
			z.object({
				libraryId: z.string(),
				name: z.string().min(1).max(100).optional(),
				description: z.string().max(500).optional().nullable(),
				muxEnvironmentId: z.string().optional().nullable(),
				tokenId: z.string().min(1).optional(),
				tokenSecret: z.string().min(1).optional(),
				signingKeyId: z.string().optional().nullable(),
				signingKeyPrivate: z.string().optional().nullable(),
				webhookSecret: z.string().optional().nullable(),
				defaultPlaybackPolicy: z
					.enum(["public", "signed"])
					.optional(),
				defaultVideoQuality: z
					.enum(["basic", "plus", "premium"])
					.optional(),
				isDefault: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);

			try {
				// Check if library exists
				const existing = await db
					.select()
					.from(muxLibrary)
					.where(eq(muxLibrary.id, input.libraryId))
					.limit(1);

				if (!existing[0]) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: `Library with ID ${input.libraryId} not found`,
					});
				}

				// If this is set as default, unset any existing default
				if (input.isDefault) {
					await db
						.update(muxLibrary)
						.set({ isDefault: false })
						.where(eq(muxLibrary.isDefault, true));
				}

				// Encrypt any credential fields being updated
				const encryptedCredentials = await encryptLibraryCredentials(
					{
						tokenId: input.tokenId,
						tokenSecret: input.tokenSecret,
						signingKeyId: input.signingKeyId,
						signingKeyPrivate: input.signingKeyPrivate,
						webhookSecret: input.webhookSecret,
					},
					env,
				);

				// Build update object with only provided fields
				const updateData: Partial<typeof muxLibrary.$inferInsert> = {};
				if (input.name !== undefined) updateData.name = input.name;
				if (input.description !== undefined)
					updateData.description = input.description;
				if (input.muxEnvironmentId !== undefined)
					updateData.muxEnvironmentId = input.muxEnvironmentId;
				if (input.tokenId !== undefined)
					updateData.tokenId = encryptedCredentials.tokenId;
				if (input.tokenSecret !== undefined)
					updateData.tokenSecret = encryptedCredentials.tokenSecret;
				if (input.signingKeyId !== undefined)
					updateData.signingKeyId = encryptedCredentials.signingKeyId;
				if (input.signingKeyPrivate !== undefined)
					updateData.signingKeyPrivate = encryptedCredentials.signingKeyPrivate;
				if (input.webhookSecret !== undefined)
					updateData.webhookSecret = encryptedCredentials.webhookSecret;
				if (input.defaultPlaybackPolicy !== undefined)
					updateData.defaultPlaybackPolicy = input.defaultPlaybackPolicy;
				if (input.defaultVideoQuality !== undefined)
					updateData.defaultVideoQuality = input.defaultVideoQuality;
				if (input.isDefault !== undefined)
					updateData.isDefault = input.isDefault;

				const [updatedLibrary] = await db
					.update(muxLibrary)
					.set(updateData)
					.where(eq(muxLibrary.id, input.libraryId))
					.returning({
						id: muxLibrary.id,
						name: muxLibrary.name,
						description: muxLibrary.description,
						defaultPlaybackPolicy: muxLibrary.defaultPlaybackPolicy,
						defaultVideoQuality: muxLibrary.defaultVideoQuality,
						isDefault: muxLibrary.isDefault,
						isActive: muxLibrary.isActive,
						createdAt: muxLibrary.createdAt,
						updatedAt: muxLibrary.updatedAt,
					});

				return updatedLibrary;
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error updating Mux library:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update Mux library",
				});
			}
		}),

	/**
	 * Delete a Mux library
	 */
	deleteLibrary: protectedProcedure
		.input(z.object({ libraryId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { env } = ctx;
			const db = getVideosDb(env);

			try {
				// Check if library exists
				const existing = await db
					.select()
					.from(muxLibrary)
					.where(eq(muxLibrary.id, input.libraryId))
					.limit(1);

				if (!existing[0]) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: `Library with ID ${input.libraryId} not found`,
					});
				}

				// Delete the library from the database
				await db
					.delete(muxLibrary)
					.where(eq(muxLibrary.id, input.libraryId));

				return { success: true };
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				console.error("Error deleting Mux library:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete Mux library",
				});
			}
		}),

	/**
	 * Test Mux library credentials
	 */
	testLibraryCredentials: protectedProcedure
		.input(
			z.object({
				tokenId: z.string().min(1),
				tokenSecret: z.string().min(1),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				const mux = new Mux({
					tokenId: input.tokenId,
					tokenSecret: input.tokenSecret,
				});

				// Try to list assets to verify credentials work
				await mux.video.assets.list({ limit: 1 });

				return { success: true, message: "Credentials are valid" };
			} catch (error) {
				console.error("Error testing Mux credentials:", error);
				return {
					success: false,
					message: "Invalid credentials or unable to connect to Mux",
				};
			}
		}),
});
