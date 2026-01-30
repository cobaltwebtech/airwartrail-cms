import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
	transformer: superjson,
});

export { t };

export const createTRPCRouter = t.router;

/**
 * Public procedure - no authentication required
 * Use this for endpoints that anyone can access
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires authentication (session or API key)
 * Throws UNAUTHORIZED error if user is not logged in
 * Use this for endpoints that require a logged-in user
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
	// Check if session exists and has a user
	if (!ctx.session?.user) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "You must be logged in to access this resource",
		});
	}

	// Pass through with narrowed session type
	return next({
		ctx: {
			...ctx,
			// Now TypeScript knows session and user are non-nullable
			session: ctx.session,
			user: ctx.session.user,
		},
	});
});

/**
 * API Key procedure - requires API key authentication
 * Throws UNAUTHORIZED error if no valid API key is provided
 * Use this for endpoints that should be accessed via API key (e.g., external app integrations)
 */
export const apiKeyProcedure = t.procedure.use(async ({ ctx, next }) => {
	// Check if authenticated via API key
	if (ctx.authType !== 'api-key' || !ctx.session?.user || !ctx.apiKey) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "A valid API key is required to access this resource",
		});
	}

	return next({
		ctx: {
			...ctx,
			session: ctx.session,
			user: ctx.session.user,
			authType: 'api-key' as const,
			apiKey: ctx.apiKey,
		},
	});
});

/**
 * Permission middleware that works with both session and API key authentication
 * - Session users: bypass permission checks (full access via CMS)
 * - API key users: must have the required permissions
 * 
 * @param resource - The resource name (e.g., 'mux', 'videos', 'libraries')
 * @param actions - Required actions (e.g., ['read'], ['read', 'write'], ['delete'])
 * 
 * @example
 * ```ts
 * // In your router:
 * listVideos: protectedProcedure
 *   .use(createPermissionMiddleware('mux', ['read']))
 *   .query(async ({ ctx }) => { ... })
 * 
 * deleteVideo: protectedProcedure
 *   .use(createPermissionMiddleware('mux', ['delete']))
 *   .mutation(async ({ ctx, input }) => { ... })
 * ```
 */
export const createPermissionMiddleware = (
	resource: string,
	actions: string[]
) => {
	return t.middleware(async ({ ctx, next }) => {
		// Session users bypass permission checks (full CMS access)
		if (ctx.authType === 'session' || ctx.authType === null) {
			return next();
		}

		// API key users must have required permissions
		if (ctx.authType === 'api-key') {
			const permissions = ctx.apiKey?.permissions;

			if (!permissions) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: `API key does not have any permissions`,
				});
			}

			const resourcePermissions = permissions[resource];
			if (!resourcePermissions) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: `API key does not have permissions for resource: ${resource}`,
				});
			}

			const hasAllActions = actions.every((action) =>
				resourcePermissions.includes(action)
			);

			if (!hasAllActions) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: `API key missing required permissions: ${actions.join(', ')} for resource: ${resource}`,
				});
			}
		}

		return next();
	});
};

