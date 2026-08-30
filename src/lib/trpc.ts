import { createTRPCClient, httpBatchLink, splitLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import superjson from 'superjson';
import { queryClient } from '@/lib/query-client';
import type { AppRouter } from '../../worker/trpc/router';

// Procedures that accept large payloads (many video IDs / playback IDs) are sent
// as POST requests. tRPC encodes query inputs in the URL by default, and
// Cloudflare Workers rejects URLs over 8KB with HTTP 431.
const POST_ONLY_PATHS = new Set([
	'mux.getThumbnailBatch',
	'mux.generateSignedTokensBatch',
	'mux.generateSignedTokens',
]);

const fetchWithCredentials = (url: RequestInfo | URL, options?: RequestInit) =>
	fetch(url, {
		...options,
		credentials: 'include',
	});

const trpcClient = createTRPCClient<AppRouter>({
	links: [
		splitLink({
			condition: (op) => POST_ONLY_PATHS.has(op.path),
			true: httpBatchLink({
				url: '/trpc',
				transformer: superjson,
				methodOverride: 'POST',
				fetch: fetchWithCredentials,
			}),
			false: httpBatchLink({
				url: '/trpc',
				transformer: superjson,
				// Auto-split batches whose URL would exceed the Cloudflare 8KB limit
				maxURLLength: 6000,
				fetch: fetchWithCredentials,
			}),
		}),
	],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
	client: trpcClient,
	queryClient,
});
