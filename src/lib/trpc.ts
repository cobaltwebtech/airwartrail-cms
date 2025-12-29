import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import superjson from 'superjson';
import { queryClient } from '@/lib/query-client';
import type { AppRouter } from '../../worker/trpc/router';

const trpcClient = createTRPCClient<AppRouter>({
	links: [
		httpBatchLink({
			url: '/trpc',
			transformer: superjson,
			fetch(url, options) {
				return fetch(url, {
					...options,
					credentials: 'include',
				});
			},
		}),
	],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
	client: trpcClient,
	queryClient,
});
