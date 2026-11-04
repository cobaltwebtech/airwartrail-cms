import { z } from "zod";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { t, protectedProcedure, publicProcedure, createPermissionMiddleware } from "../../trpc-init";
import { siteContent } from "@/db/content-schema";

// ============================================================================
// Database Helper
// ============================================================================

export function getSiteContentDb(env: Env) {
	return drizzle(env.DB_CONTENT);
}

// ============================================================================
// Types
// ============================================================================

/**
 * Fixed keys for single-route frontend pages whose content is managed in the CMS.
 * Add a key here to support another single-route page.
 */
export const SITE_CONTENT_KEYS = ["about"] as const;

export type SiteContentKey = (typeof SITE_CONTENT_KEYS)[number];

export interface SiteContent {
	key: SiteContentKey;
	content: unknown;
	updatedBy: string | null;
	updatedAt: Date | null;
}

// ============================================================================
// Schemas
// ============================================================================

const siteContentKeySchema = z.enum(SITE_CONTENT_KEYS);

const getSiteContentSchema = z.object({
	key: siteContentKeySchema,
});

const updateSiteContentSchema = z.object({
	key: siteContentKeySchema,
	content: z.unknown(),
});

// ============================================================================
// Site Content Router
// ============================================================================

export const siteContentRouter = t.router({
	/**
	 * Get the content for a single-route page by key.
	 * Returns null content if the page has never been saved.
	 */
	get: publicProcedure.input(getSiteContentSchema).query(async ({ ctx, input }): Promise<SiteContent> => {
		const db = getSiteContentDb(ctx.env);

		const [row] = await db
			.select()
			.from(siteContent)
			.where(eq(siteContent.id, input.key))
			.limit(1);

		return {
			key: input.key,
			content: row?.content ?? null,
			updatedBy: row?.updatedBy ?? null,
			updatedAt: row?.updatedAt ?? null,
		};
	}),

	/**
	 * Create or replace the content for a single-route page
	 */
	update: protectedProcedure
		.use(createPermissionMiddleware("content", ["write"]))
		.input(updateSiteContentSchema)
		.mutation(async ({ ctx, input }): Promise<SiteContent> => {
			const db = getSiteContentDb(ctx.env);

			const [row] = await db
				.insert(siteContent)
				.values({
					id: input.key,
					content: input.content ?? null,
					updatedBy: ctx.user.name,
					updatedById: ctx.user.id,
				})
				.onConflictDoUpdate({
					target: siteContent.id,
					set: {
						content: input.content ?? null,
						updatedBy: ctx.user.name,
						updatedById: ctx.user.id,
						updatedAt: new Date(),
					},
				})
				.returning();

			return {
				key: input.key,
				content: row.content,
				updatedBy: row.updatedBy,
				updatedAt: row.updatedAt,
			};
		}),
});
