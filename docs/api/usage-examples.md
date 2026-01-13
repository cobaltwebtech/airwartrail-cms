# Usage Examples

Practical implementation examples for common use cases.

---

## Server-Side Data Fetching in Astro Pages

Fetch data server-side via Service Bindings:

```astro
---
// src/pages/videos/index.astro
import { createServerTRPCClient } from '../lib/trpc-server';
import VideoGrid from '../components/VideoGrid';

const { env } = Astro.locals.runtime;
const trpc = createServerTRPCClient(env, Astro.request);

const videos = await trpc.mux.listVideosFromDatabase.query({
  libraryId: 'your-library-id',
  limit: 20,
  offset: 0,
});
---

<html>
  <body>
    <h1>Videos</h1>
    <VideoGrid client:load videos={videos} />
  </body>
</html>
```

---

## Server-Side Data Fetching in API Routes

```typescript
// src/pages/api/videos/[id].ts
import type { APIRoute } from 'astro';
import { createServerTRPCClient } from '../../../lib/trpc-server';

export const GET: APIRoute = async ({ params, request, locals }) => {
  const { env } = locals.runtime;
  const trpc = createServerTRPCClient(env, request);
  
  const video = await trpc.mux.getVideoById.query({
    videoId: params.id!,
    libraryId: 'your-library-id',
  });
  
  return new Response(JSON.stringify(video), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

---

## Client-Side Fetching with TanStack Query

```tsx
// src/components/VideoList.tsx
import { useQuery } from '@tanstack/react-query';
import { trpc } from '../lib/trpc-client';

function VideoList({ libraryId }: { libraryId: string }) {
  const { data: videos, isLoading, error } = useQuery(
    trpc.mux.listVideosFromDatabase.queryOptions({
      libraryId,
      limit: 20,
      offset: 0,
    })
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {videos?.map((video) => (
        <div key={video.id}>
          <h3>{video.title}</h3>
          <p>Duration: {video.duration}s</p>
        </div>
      ))}
    </div>
  );
}
```

---

## Hybrid: Server Prefetch + Client Hydration

```astro
---
// src/pages/videos/[id].astro
import { createServerTRPCClient } from '../../lib/trpc-server';
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import VideoDetail from '../../components/VideoDetail';
import Providers from '../../components/Providers';

const { env } = Astro.locals.runtime;
const trpc = createServerTRPCClient(env, Astro.request);

const videoId = Astro.params.id!;
const libraryId = 'your-library-id';

// Prefetch data server-side
const queryClient = new QueryClient();
await queryClient.prefetchQuery({
  queryKey: ['mux', 'getVideoById', { videoId, libraryId }],
  queryFn: () => trpc.mux.getVideoById.query({ videoId, libraryId }),
});

const dehydratedState = dehydrate(queryClient);
---

<html>
  <body>
    <Providers client:load>
      <HydrationBoundary state={dehydratedState} client:load>
        <VideoDetail client:load videoId={videoId} libraryId={libraryId} />
      </HydrationBoundary>
    </Providers>
  </body>
</html>
```

---

## Fetching Playlists

```tsx
function PlaylistGrid({ libraryId }: { libraryId: string }) {
  const { data: playlists } = useQuery(
    trpc.mux.listPlaylists.queryOptions({
      libraryId,
      includeUnpublished: false,
      category: 'featured',
    })
  );

  return (
    <div className="grid grid-cols-3 gap-4">
      {playlists?.map((playlist) => (
        <div key={playlist.id}>
          <h3>{playlist.name}</h3>
          <p>{playlist.videoCount} videos</p>
          {playlist.thumbnailPlaybackId && (
            <img
              src={`https://image.mux.com/${playlist.thumbnailPlaybackId}/thumbnail.jpg`}
              alt={playlist.name}
            />
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## Handling Signed Playback

```tsx
function SignedVideoPlayer({ 
  playbackId, 
  libraryId 
}: { 
  playbackId: string; 
  libraryId: string;
}) {
  const { data: tokens } = useQuery(
    trpc.mux.generateSignedTokens.queryOptions({
      playbackId,
      libraryId,
      expiresIn: 7200, // 2 hours
    })
  );

  if (!tokens) return <div>Loading...</div>;

  return (
    <video
      src={`https://stream.mux.com/${playbackId}.m3u8?token=${tokens.playback}`}
      controls
    />
  );
}
```

---

## Using API Key Authentication

```typescript
// src/pages/api/public/videos.ts
import type { APIRoute } from 'astro';
import { createApiKeyTRPCClient } from '../../../lib/trpc-server';

export const GET: APIRoute = async ({ locals }) => {
  const { env } = locals.runtime;
  
  // Use API key auth via Service Binding
  const trpc = createApiKeyTRPCClient(env, import.meta.env.AWT_API_KEY);
  
  const videos = await trpc.mux.listVideosFromDatabase.query({
    libraryId: 'your-library-id',
    limit: 10,
  });
  
  return new Response(JSON.stringify(videos), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

---

## Creating and Managing Playlists

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '../lib/trpc-client';

function CreatePlaylistForm({ libraryId }: { libraryId: string }) {
  const queryClient = useQueryClient();
  
  const createMutation = useMutation({
    mutationFn: (data: PlaylistInput) => 
      trpc.mux.createPlaylist.mutate({ ...data, libraryId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['mux', 'listPlaylists']);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: 'New Playlist',
      slug: 'new-playlist',
      category: 'series',
    });
  };

  return <form onSubmit={handleSubmit}>{/* ... */}</form>;
}
```

---

## Uploading Videos

```tsx
import { useMutation } from '@tanstack/react-query';
import { trpc } from '../lib/trpc-client';

function VideoUploader({ libraryId }: { libraryId: string }) {
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // 1. Create upload URL
      const upload = await trpc.mux.createDirectUpload.mutate({
        libraryId,
        corsOrigin: window.location.origin,
        title: file.name,
        autoCaptions: { enabled: true, languageCode: 'en' },
      });

      // 2. Upload file
      await fetch(upload.url, {
        method: 'PUT',
        body: file,
      });

      // 3. Poll for completion
      let status = 'waiting';
      while (status === 'waiting') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const result = await trpc.mux.getDirectUpload.query({
          uploadId: upload.id,
          libraryId,
        });
        status = result.status;
      }

      return upload;
    },
  });

  return (
    <input
      type="file"
      onChange={(e) => e.target.files?.[0] && uploadMutation.mutate(e.target.files[0])}
    />
  );
}
```

---

## Related Documentation

- [Mux Router API](./mux-router.md) - Complete API reference
- [tRPC Client Setup](./trpc-setup.md) - Client configuration
- [Video Player Integration](./video-player.md) - Player examples
- [Best Practices](./best-practices.md) - Implementation guidelines
