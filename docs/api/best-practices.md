# Best Practices

Implementation guidelines and recommendations for working with the AirWarTrail Dashboard API.

---

## Service Bindings

### 1. Deploy the API Worker First

When deploying for the first time, the target Worker (airwartrail-dashboard) must exist before the frontend Worker can be deployed.

```bash
# 1. Deploy API Worker
cd airwartrail-dashboard
wrangler deploy

# 2. Deploy Frontend Worker
cd ../airwartrail-frontend
wrangler deploy
```

---

### 2. Always Await Service Binding Calls

If you don't await, the API Worker will be terminated early:

```typescript
// ❌ BAD - Worker terminates before response
env.AWT_API.fetch(request);

// ✅ GOOD - Wait for the response
await env.AWT_API.fetch(request);
```

---

### 3. Forward Headers for Authentication

Always forward the original request headers to preserve session cookies:

```typescript
// ✅ GOOD - Forwards auth cookies
const response = await env.AWT_API.fetch(new Request(url, {
  headers: Astro.request.headers,
}));
```

---

### 4. The URL Doesn't Matter

When using `env.AWT_API.fetch()`, the URL is only used for routing within the target Worker. Using `https://awt-api-worker/...` is a common convention:

```typescript
// Both work the same with Service Bindings
await env.AWT_API.fetch('https://awt-api-worker/trpc/mux.listVideos');
await env.AWT_API.fetch('https://different.example.com/trpc/mux.listVideos');
```

---

## API Usage

### 5. Use Internal Video IDs

Always use internal database IDs (`videoId`) for navigation and database operations, not Mux asset IDs (`muxAssetId`):

```typescript
// ✅ GOOD - Use internal ID
await trpc.mux.getVideoById.query({ 
  videoId: 'video_123',
  libraryId: 'lib_abc'
});

// ❌ AVOID - Mux asset IDs are for Mux API calls only
await trpc.mux.getAsset.query({ 
  assetId: 'mux_asset_xyz'
});
```

---

### 6. Sync Videos Before Use

If videos were uploaded directly to Mux, sync them to the database first:

```typescript
// Sync all assets
await trpc.mux.syncMuxAssets.mutate({ libraryId });

// Or sync a single asset
await trpc.mux.syncSingleAsset.mutate({ 
  muxAssetId: 'asset_123',
  libraryId 
});
```

---

### 7. Library ID is Often Required

Most procedures need a `libraryId`. Consider storing it in context:

```typescript
// Create a context provider
const LibraryContext = createContext<string>('');

export function LibraryProvider({ children, libraryId }: Props) {
  return (
    <LibraryContext.Provider value={libraryId}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  return useContext(LibraryContext);
}
```

---

### 8. Handle Signed Playback

For videos with `policy: 'signed'`, always fetch tokens before playing:

```typescript
function VideoPlayer({ video }: { video: Video }) {
  const { data: tokens } = useQuery(
    trpc.mux.generateSignedTokens.queryOptions({
      playbackId: video.playbackId,
      libraryId: video.libraryId,
    }),
    {
      enabled: video.policy === 'signed',
    }
  );

  return (
    <MuxPlayer
      playbackId={video.playbackId}
      tokens={video.policy === 'signed' ? tokens : undefined}
    />
  );
}
```

---

### 9. Use SuperJSON Transformer

The tRPC client MUST use SuperJSON to properly serialize/deserialize dates and other complex types:

```typescript
import superjson from 'superjson';

const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      transformer: superjson, // ✅ Required
    }),
  ],
});
```

---

### 10. Handle Rate Limiting

API keys have rate limiting (1000 requests/hour by default). Handle 429 responses:

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof TRPCClientError) {
          // Don't retry rate limit errors
          if (error.data?.code === 'TOO_MANY_REQUESTS') {
            return false;
          }
        }
        return failureCount < 3;
      },
    },
  },
});
```

---

### 11. Use Pagination

Use `limit` and `offset` parameters for large collections:

```typescript
// ✅ GOOD - Paginated
const videos = await trpc.mux.listVideosFromDatabase.query({
  libraryId,
  limit: 50,
  offset: page * 50,
});

// ❌ BAD - Fetches everything
const videos = await trpc.mux.listVideosFromDatabase.query({
  libraryId,
  limit: 1000,
});
```

---

### 12. Prefetch Data Server-Side

For better performance, prefetch data server-side in Astro:

```astro
---
// Prefetch on the server via Service Binding
const { env } = Astro.locals.runtime;
const trpc = createServerTRPCClient(env, Astro.request);

const videos = await trpc.mux.listVideosFromDatabase.query({
  libraryId: 'lib_123',
  limit: 20,
});
---

<VideoGrid videos={videos} client:load />
```

---

## Security

### 13. Never Expose API Keys Client-Side

API keys should only be used server-side:

```typescript
// ❌ NEVER - Exposes API key to browser
const apiKey = 'awt_secret_key';
const trpc = createApiKeyTRPCClient(env, apiKey);

// ✅ GOOD - API key stays on server
export const GET: APIRoute = async ({ locals }) => {
  const { env } = locals.runtime;
  const trpc = createApiKeyTRPCClient(
    env, 
    import.meta.env.AWT_API_KEY // Server-side only
  );
};
```

---

### 14. Store API Keys Securely

When creating API keys, store them immediately (they're only shown once):

```typescript
const apiKey = await trpc.apiKeys.create.mutate({
  name: 'Production Key',
});

// ⚠️ ONLY CHANCE - Store this securely
await storeInVault(apiKey.key);
```

---

### 15. Use Minimal Permissions

Grant API keys only the permissions they need:

```typescript
// ✅ GOOD - Minimal permissions
await trpc.apiKeys.create.mutate({
  name: 'Read-only Analytics Key',
  permissions: {
    mux: ['read'],
  },
});

// ❌ BAD - Excessive permissions
await trpc.apiKeys.create.mutate({
  name: 'Analytics Key',
  permissions: {
    mux: ['read', 'write', 'delete'],
    playlists: ['read', 'write', 'delete'],
  },
});
```

---

## Performance

### 16. Batch Queries with TanStack Query

Use `useQueries` to batch multiple queries:

```typescript
import { useQueries } from '@tanstack/react-query';
import { trpc } from '../lib/trpc-client';

function VideoComparison({ videoIds, libraryId }: Props) {
  const queries = useQueries({
    queries: videoIds.map(videoId => 
      trpc.mux.getVideoById.queryOptions({ videoId, libraryId })
    ),
  });

  // All queries run in parallel
  return queries.map((query, i) => (
    <div key={i}>{query.data?.title}</div>
  ));
}
```

---

### 17. Use Stale-While-Revalidate

Configure appropriate stale times for less critical data:

```typescript
const { data } = useQuery(
  trpc.mux.listPlaylists.queryOptions({ libraryId }),
  {
    staleTime: 1000 * 60 * 5, // 5 minutes
  }
);
```

---

### 18. Optimize Thumbnail Loading

Use appropriate thumbnail sizes:

```typescript
// ❌ BAD - Full resolution thumbnail (slow)
<img src={`https://image.mux.com/${playbackId}/thumbnail.jpg`} />

// ✅ GOOD - Sized appropriately
<img 
  src={`https://image.mux.com/${playbackId}/thumbnail.jpg?width=320&height=180`}
  loading="lazy"
/>
```

---

## Error Handling

### 19. Handle Errors Gracefully

Always provide fallbacks for failed requests:

```typescript
function VideoTitle({ videoId, libraryId }: Props) {
  const { data, error, isError } = useQuery(
    trpc.mux.getVideoById.queryOptions({ videoId, libraryId })
  );

  if (isError) {
    return <div>Unable to load video</div>;
  }

  return <h1>{data?.title ?? 'Loading...'}</h1>;
}
```

---

### 20. Monitor API Key Usage

Regularly check API key usage:

```typescript
const keys = await trpc.apiKeys.list.query();

keys.forEach(key => {
  if (key.requestCount > 800_000) {
    console.warn(`Key ${key.name} approaching limit`);
  }
});
```

---

## Related Documentation

- [Architecture](./architecture.md) - Service Bindings overview
- [Authentication](./authentication.md) - Security best practices
- [Error Handling](./error-handling.md) - Error handling strategies
- [Usage Examples](./usage-examples.md) - Implementation patterns
