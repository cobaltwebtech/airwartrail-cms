import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, asc, sql, like, or, and, isNotNull, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { t, protectedProcedure } from "../../trpc-init";
import {
	user,
	session,
	account,
	subscription,
} from "@/db/frontend-auth-schema";

// ============================================================================
// Database Helper
// ============================================================================

function getFrontendAuthDb(env: Env) {
	return drizzle(env.DB_FRONTEND_AUTH);
}

// ============================================================================
// Input Schemas
// ============================================================================

const paginationSchema = z.object({
	limit: z.number().min(1).max(100).default(25),
	page: z.number().min(1).default(1),
	search: z.string().optional(),
	sortBy: z.string().optional(),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const listUsersSchema = paginationSchema.extend({
	sortBy: z.enum(["createdAt", "updatedAt", "name", "email"]).default("createdAt"),
	role: z.string().optional(),
	banned: z.boolean().optional(),
	subscriptionFilter: z.enum(["active", "canceled", "none"]).optional(),
});

const listSessionsSchema = paginationSchema.extend({
	sortBy: z.enum(["createdAt", "expiresAt"]).default("createdAt"),
	userId: z.string().optional(),
});

const listAccountsSchema = paginationSchema.extend({
	sortBy: z.enum(["createdAt", "updatedAt"]).default("createdAt"),
	userId: z.string().optional(),
	providerId: z.string().optional(),
});

const listSubscriptionsSchema = paginationSchema.extend({
	sortBy: z.enum(["periodStart", "periodEnd"]).default("periodStart"),
	status: z.string().optional(),
	plan: z.string().optional(),
});

// ============================================================================
// Frontend Auth Router (Read-Only)
// ============================================================================

export const frontendAuthRouter = t.router({
	// ──────────────────────────────────────────────────────────────────────
	// Users
	// ──────────────────────────────────────────────────────────────────────

	getUser: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const db = getFrontendAuthDb(ctx.env);

			const [result] = await db
				.select()
				.from(user)
				.where(eq(user.id, input.id))
				.limit(1);

			if (!result) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "User not found",
				});
			}

			// Fetch related data in parallel
			const [userSessions, userAccounts, userSubscriptions] =
				await Promise.all([
					db
						.select()
						.from(session)
						.where(eq(session.userId, input.id))
						.orderBy(desc(session.createdAt)),
					db
						.select({
							id: account.id,
							accountId: account.accountId,
							providerId: account.providerId,
							userId: account.userId,
							scope: account.scope,
							createdAt: account.createdAt,
							updatedAt: account.updatedAt,
						})
						.from(account)
						.where(eq(account.userId, input.id))
						.orderBy(desc(account.createdAt)),
					db
						.select()
						.from(subscription)
						.where(eq(subscription.referenceId, input.id))
						.orderBy(desc(subscription.periodStart)),
				]);

			return {
				...result,
				sessions: userSessions,
				accounts: userAccounts,
				subscriptions: userSubscriptions,
			};
		}),

	listUsers: protectedProcedure
		.input(listUsersSchema.optional())
		.query(async ({ ctx, input }) => {
			const db = getFrontendAuthDb(ctx.env);

			const limit = input?.limit ?? 25;
			const page = input?.page ?? 1;
			const offset = (page - 1) * limit;

			const conditions = [];

			if (input?.role) {
				conditions.push(eq(user.role, input.role));
			}

			if (input?.banned !== undefined) {
				conditions.push(eq(user.banned, input.banned));
			}

			if (input?.search) {
				const searchPattern = `%${input.search}%`;
				conditions.push(
					or(
						like(user.name, searchPattern),
						like(user.email, searchPattern),
					),
				);
			}

			if (input?.subscriptionFilter === "active") {
				conditions.push(
					isNotNull(
						db
							.select({ id: subscription.id })
							.from(subscription)
							.where(
								and(
									eq(subscription.referenceId, user.id),
									eq(subscription.status, "active"),
								),
							),
					),
				);
			} else if (input?.subscriptionFilter === "canceled") {
				conditions.push(
					isNotNull(
						db
							.select({ id: subscription.id })
							.from(subscription)
							.where(
								and(
									eq(subscription.referenceId, user.id),
									eq(subscription.status, "canceled"),
								),
							),
					),
				);
			} else if (input?.subscriptionFilter === "none") {
				conditions.push(
					isNull(
						db
							.select({ id: subscription.id })
							.from(subscription)
							.where(
								eq(subscription.referenceId, user.id),
							),
					),
				);
			}

			const whereClause =
				conditions.length > 0
					? conditions.length === 1
						? conditions[0]
						: sql`${conditions[0]} AND ${conditions.slice(1).reduce((acc, c) => sql`${acc} AND ${c}`)}`
					: undefined;

			const sortColumn = {
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
				name: user.name,
				email: user.email,
			}[input?.sortBy ?? "createdAt"];

			const sortFn = input?.sortOrder === "asc" ? asc : desc;

			// LEFT JOIN subscription to get active subscription status per user
			const results = await db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					emailVerified: user.emailVerified,
					image: user.image,
					createdAt: user.createdAt,
					updatedAt: user.updatedAt,
					role: user.role,
					banned: user.banned,
					banReason: user.banReason,
					banExpires: user.banExpires,
					lastActiveAt: user.lastActiveAt,
					stripeCustomerId: user.stripeCustomerId,
					subscriptionStatus: subscription.status,
					subscriptionPlan: subscription.plan,
				})
				.from(user)
				.leftJoin(
					subscription,
					and(
						eq(subscription.referenceId, user.id),
						or(
							eq(subscription.status, "active"),
							eq(subscription.status, "canceled"),
						),
					),
				)
				.where(whereClause)
				.orderBy(sortFn(sortColumn))
				.limit(limit)
				.offset(offset);

			const [countResult] = await db
				.select({ count: sql<number>`count(*)` })
				.from(user)
				.where(whereClause);

			const total = countResult?.count ?? 0;

			return {
				users: results,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
					hasNext: page * limit < total,
					hasPrevious: page > 1,
				},
			};
		}),

	// ──────────────────────────────────────────────────────────────────────
	// Sessions
	// ──────────────────────────────────────────────────────────────────────

	getSession: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const db = getFrontendAuthDb(ctx.env);

			const [result] = await db
				.select()
				.from(session)
				.where(eq(session.id, input.id))
				.limit(1);

			if (!result) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Session not found",
				});
			}

			return result;
		}),

	listSessions: protectedProcedure
		.input(listSessionsSchema.optional())
		.query(async ({ ctx, input }) => {
			const db = getFrontendAuthDb(ctx.env);

			const limit = input?.limit ?? 25;
			const page = input?.page ?? 1;
			const offset = (page - 1) * limit;

			const conditions = [];

			if (input?.userId) {
				conditions.push(eq(session.userId, input.userId));
			}

			const whereClause =
				conditions.length > 0 ? conditions[0] : undefined;

			const sortColumn = {
				createdAt: session.createdAt,
				expiresAt: session.expiresAt,
			}[input?.sortBy ?? "createdAt"];

			const sortFn = input?.sortOrder === "asc" ? asc : desc;

			const results = await db
				.select()
				.from(session)
				.where(whereClause)
				.orderBy(sortFn(sortColumn))
				.limit(limit)
				.offset(offset);

			const [countResult] = await db
				.select({ count: sql<number>`count(*)` })
				.from(session)
				.where(whereClause);

			const total = countResult?.count ?? 0;

			return {
				sessions: results,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
					hasNext: page * limit < total,
					hasPrevious: page > 1,
				},
			};
		}),

	// ──────────────────────────────────────────────────────────────────────
	// Accounts
	// ──────────────────────────────────────────────────────────────────────

	getAccount: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const db = getFrontendAuthDb(ctx.env);

			const [result] = await db
				.select({
					id: account.id,
					accountId: account.accountId,
					providerId: account.providerId,
					userId: account.userId,
					scope: account.scope,
					createdAt: account.createdAt,
					updatedAt: account.updatedAt,
				})
				.from(account)
				.where(eq(account.id, input.id))
				.limit(1);

			if (!result) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Account not found",
				});
			}

			return result;
		}),

	listAccounts: protectedProcedure
		.input(listAccountsSchema.optional())
		.query(async ({ ctx, input }) => {
			const db = getFrontendAuthDb(ctx.env);

			const limit = input?.limit ?? 25;
			const page = input?.page ?? 1;
			const offset = (page - 1) * limit;

			const conditions = [];

			if (input?.userId) {
				conditions.push(eq(account.userId, input.userId));
			}

			if (input?.providerId) {
				conditions.push(eq(account.providerId, input.providerId));
			}

			const whereClause =
				conditions.length > 0
					? conditions.length === 1
						? conditions[0]
						: sql`${conditions[0]} AND ${conditions[1]}`
					: undefined;

			const sortColumn = {
				createdAt: account.createdAt,
				updatedAt: account.updatedAt,
			}[input?.sortBy ?? "createdAt"];

			const sortFn = input?.sortOrder === "asc" ? asc : desc;

			const results = await db
				.select({
					id: account.id,
					accountId: account.accountId,
					providerId: account.providerId,
					userId: account.userId,
					scope: account.scope,
					createdAt: account.createdAt,
					updatedAt: account.updatedAt,
				})
				.from(account)
				.where(whereClause)
				.orderBy(sortFn(sortColumn))
				.limit(limit)
				.offset(offset);

			const [countResult] = await db
				.select({ count: sql<number>`count(*)` })
				.from(account)
				.where(whereClause);

			const total = countResult?.count ?? 0;

			return {
				accounts: results,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
					hasNext: page * limit < total,
					hasPrevious: page > 1,
				},
			};
		}),

	// ──────────────────────────────────────────────────────────────────────
	// Subscriptions
	// ──────────────────────────────────────────────────────────────────────

	getSubscription: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const db = getFrontendAuthDb(ctx.env);

			const [result] = await db
				.select()
				.from(subscription)
				.where(eq(subscription.id, input.id))
				.limit(1);

			if (!result) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Subscription not found",
				});
			}

			return result;
		}),

	listSubscriptions: protectedProcedure
		.input(listSubscriptionsSchema.optional())
		.query(async ({ ctx, input }) => {
			const db = getFrontendAuthDb(ctx.env);

			const limit = input?.limit ?? 25;
			const page = input?.page ?? 1;
			const offset = (page - 1) * limit;

			const conditions = [];

			if (input?.status) {
				conditions.push(eq(subscription.status, input.status));
			}

			if (input?.plan) {
				conditions.push(eq(subscription.plan, input.plan));
			}

			const whereClause =
				conditions.length > 0
					? conditions.length === 1
						? conditions[0]
						: sql`${conditions[0]} AND ${conditions[1]}`
					: undefined;

			const sortColumn = {
				periodStart: subscription.periodStart,
				periodEnd: subscription.periodEnd,
			}[input?.sortBy ?? "periodStart"];

			const sortFn = input?.sortOrder === "asc" ? asc : desc;

			const results = await db
				.select()
				.from(subscription)
				.where(whereClause)
				.orderBy(sortFn(sortColumn))
				.limit(limit)
				.offset(offset);

			const [countResult] = await db
				.select({ count: sql<number>`count(*)` })
				.from(subscription)
				.where(whereClause);

			const total = countResult?.count ?? 0;

			return {
				subscriptions: results,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
					hasNext: page * limit < total,
					hasPrevious: page > 1,
				},
			};
		}),

	// ──────────────────────────────────────────────────────────────────────
	// Aggregated / Dashboard Stats
	// ──────────────────────────────────────────────────────────────────────

	getStats: protectedProcedure.query(async ({ ctx }) => {
		const db = getFrontendAuthDb(ctx.env);

		const [userCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(user);

		const [activeSessionCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(session)
			.where(sql`${session.expiresAt} > ${Date.now()}`);

		const [subscriptionCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(subscription)
			.where(eq(subscription.status, "active"));

		const [bannedCount] = await db
			.select({ count: sql<number>`count(*)` })
			.from(user)
			.where(eq(user.banned, true));

		return {
			totalUsers: userCount?.count ?? 0,
			activeSessions: activeSessionCount?.count ?? 0,
			activeSubscriptions: subscriptionCount?.count ?? 0,
			bannedUsers: bannedCount?.count ?? 0,
		};
	}),
});
