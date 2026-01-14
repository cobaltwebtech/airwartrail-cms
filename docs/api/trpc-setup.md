# tRPC Client Setup

This guide shows how to set up tRPC clients for both server-side (Service Bindings) and client-side (browser) usage.

---

## Required Dependencies

```bash
pnpm add @trpc/client @trpc/tanstack-react-query @tanstack/react-query superjson
```

---

## Server-Side tRPC Client (Service Bindings)

Create a tRPC client that uses Service Bindings for server-side calls in Astro pages and API routes:

```typescript
// src/lib/trpc-server.ts
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from './types';

/**
 * Create a tRPC client that uses Service Bindings for server-side calls.
 * This should be used in Astro pages, API routes, and server-side components.
 * 
 * @param env - The Cloudflare environment from Astro.locals.runtime
 * @param request - The original request (for forwarding cookies/headers)
 */
export function createServerTRPCClient(env: Env, request?: Request) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: 'https://awt-api-worker/trpc', // URL doesn't matter for service bindings
        transformer: superjson,
        headers: request ? Object.fromEntries(request.headers) : {},
        fetch: async (url, options) => {
          // Use Service Binding instead of public HTTP
          const internalRequest = new Request(url, options);
          return env.AWT_API.fetch(internalRequest);
        },
      }),
    ],
  });
}

/**
 * Create a tRPC client with API key authentication for server-side calls.
 * Use this when you need to make authenticated calls without user session.
 */
export function createApiKeyTRPCClient(env: Env, apiKey: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: 'https://awt-backend-worker/trpc',
        transformer: superjson,
        headers: {
          'x-api-key': apiKey,
        },
        fetch: async (url, options) => {
          const internalRequest = new Request(url, options);
          return env.AWT_API.fetch(internalRequest);
        },
      }),
    ],
  });
}
```

---

## Client-Side tRPC Client (Browser)

For React components running in the browser, use a traditional HTTP client that proxies through your Astro server:

```typescript
// src/lib/trpc-client.ts
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import superjson from 'superjson';
import { QueryClient } from '@tanstack/react-query';
import type { AppRouter } from './types';

// Query client for TanStack Query
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Client-side tRPC client - calls go through Astro's API proxy
const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc', // Proxy endpoint on your Astro server
      transformer: superjson,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include', // Forward cookies for session auth
        });
      },
    }),
  ],
});

// TanStack Query integration for React components
export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
```

---

## Astro API Proxy Route

Create an API route that proxies browser requests through Service Bindings:

```typescript
// src/pages/api/trpc/[...trpc].ts
import type { APIRoute } from 'astro';

export const ALL: APIRoute = async ({ params, request, locals }) => {
  const { env } = locals.runtime;
  
  // Build the internal URL for the tRPC endpoint
  const path = params.trpc || '';
  const url = new URL(request.url);
  const internalUrl = `https://awt-api-worker/trpc/${path}${url.search}`;
  
  // Forward the request to the API Worker via Service Binding
  const internalRequest = new Request(internalUrl, {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' ? request.body : undefined,
  });
  
  const response = await env.AWT_API.fetch(internalRequest);
  
  // Return the response from the API Worker
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
```

---

## React Query Provider Setup

Wrap your React app with the QueryClientProvider:

```tsx
// src/components/Providers.tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/trpc-client';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

---

## Usage Examples

### Server-Side in Astro Pages

```astro
---
// src/pages/videos/index.astro
import { createServerTRPCClient } from '../lib/trpc-server';

const { env } = Astro.locals.runtime;
const trpc = createServerTRPCClient(env, Astro.request);

const videos = await trpc.mux.listVideosFromDatabase.query({
  libraryId: 'your-library-id',
  limit: 20,
});
---

<h1>Videos: {videos.length}</h1>
```

### Client-Side in React Components

```tsx
import { useQuery } from '@tanstack/react-query';
import { trpc } from '../lib/trpc-client';

function VideoList({ libraryId }: { libraryId: string }) {
  const { data: videos } = useQuery(
    trpc.mux.listVideosFromDatabase.queryOptions({
      libraryId,
      limit: 20,
    })
  );

  return <div>{videos?.length} videos</div>;
}
```

---

## Related Documentation

- [Architecture](./architecture.md) - Service Bindings overview
- [Authentication](./authentication.md) - Auth configuration
- [Usage Examples](./usage-examples.md) - More implementation patterns
