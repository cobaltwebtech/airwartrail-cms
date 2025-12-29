import { redirect } from '@tanstack/react-router';
import { queryClient } from '@/lib/query-client';

/**
 * Client-side session fetcher for TanStack Router.
 * Uses TanStack Query for caching to avoid repeated requests.
 */
async function getSession() {
	try {
		return await queryClient.fetchQuery({
			queryKey: ['auth', 'session'],
			queryFn: async () => {
				const response = await fetch('/api/auth/get-session', {
					credentials: 'include',
				});
				if (!response.ok) {
					return null;
				}
				const data = (await response.json()) as { session?: unknown };
				return data.session || null;
			},
			staleTime: 5 * 60 * 1000, // 5 minutes, matching Better Auth server cache
			gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
		});
	} catch {
		return null;
	}
}

/**
 * Requires user to be authenticated.
 * Use this in beforeLoad for protected routes.
 * Redirects to login with return URL if not authenticated.
 *
 * @example
 * export const Route = createFileRoute('/_dashboard')({
 *   beforeLoad: async ({ location }) => {
 *     const session = await requireAuth(location);
 *     return { session };
 *   },
 * });
 */
export async function requireAuth(location: {
	pathname: string;
	href?: string;
	search: Record<string, unknown>;
}) {
	const session = await getSession();

	if (!session) {
		// Redirect to login with return URL
		throw redirect({
			to: '/auth/login',
			search: {
				redirect: location.href || location.pathname,
				error: undefined,
			},
		});
	}

	return session;
}

/**
 * Optional auth check - doesn't redirect, just returns session or null.
 * Useful for pages that have different content for logged-in vs logged-out users.
 *
 * @example
 * export const Route = createFileRoute('/')({
 *   beforeLoad: async () => {
 *     const session = await optionalAuth();
 *     return { session };
 *   },
 * });
 */
export async function optionalAuth() {
	const session = await getSession();
	return session;
}

/**
 * Prevents authenticated users from accessing auth pages (login, signup, etc).
 * Use this in beforeLoad for auth routes.
 * Redirects to home or specified destination if already logged in.
 *
 * @example
 * export const Route = createFileRoute('/auth/login')({
 *   validateSearch: (search: Record<string, unknown>) => ({
 *     redirect: (search.redirect as string) || '/',
 *   }),
 *   beforeLoad: async ({ search }) => {
 *     await requireNoSession(search.redirect);
 *   },
 * });
 */
export async function requireNoSession(redirectTo: string = '/') {
	const session = await getSession();

	if (session) {
		// Redirect to home or the intended destination
		throw redirect({
			to: redirectTo,
		});
	}
}

/**
 * Invalidates the session cache.
 * Call this after sign out or when session state changes.
 */
export function invalidateSessionCache() {
	queryClient.removeQueries({ queryKey: ['auth', 'session'] });
}
