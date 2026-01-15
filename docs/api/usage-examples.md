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

## Tag Management

### Creating and Managing Tags

```tsx
import { useMutation, useQuery } from '@tanstack/react-query';
import { trpc } from '../lib/trpc-client';

function TagManager() {
  const { data: tags } = useQuery(
    trpc.mux.listTags.queryOptions()
  );

  const createTagMutation = useMutation({
    mutationFn: (data) => 
      trpc.mux.createTag.mutate({
        name: data.name,
        description: data.description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['mux', 'listTags']);
    },
  });

  return (
    <div>
      {tags?.map((tag) => (
        <div key={tag.id}>
          <strong>{tag.name}</strong>
          <p>{tag.description}</p>
        </div>
      ))}
    </div>
  );
}
```

### Assigning Tags to a Video

```tsx
import { useMutation, useQuery } from '@tanstack/react-query';
import { trpc } from '../lib/trpc-client';
import { MultiSelect } from '@/components/ui/multi-select';

function VideoTagAssignment({ 
  videoId, 
  libraryId 
}: { 
  videoId: string; 
  libraryId: string;
}) {
  const { data: allTags } = useQuery(
    trpc.mux.listTags.queryOptions()
  );

  const { data: currentTags } = useQuery(
    trpc.mux.getVideoTags.queryOptions({
      videoId,
      libraryId,
    })
  );

  const setTagsMutation = useMutation({
    mutationFn: (tagIds: string[]) =>
      trpc.mux.setVideoTags.mutate({
        videoId,
        libraryId,
        tagIds,
      }),
    onSuccess: () => {
      toast.success('Tags updated successfully');
    },
  });

  return (
    <div>
      <label>Assign Tags</label>
      <MultiSelect
        options={allTags?.map(tag => ({
          label: tag.name,
          value: tag.id,
        })) || []}
        defaultValue={currentTags?.map(t => t.id) || []}
        onValueChange={(values) => setTagsMutation.mutate(values)}
      />
    </div>
  );
}
```

### Searching Videos by Tags

```tsx
import { useQuery } from '@tanstack/react-query';
import { trpc } from '../lib/trpc-client';
import { Button } from '@/components/ui/button';

function VideoSearchByTags({ 
  libraryId 
}: { 
  libraryId: string;
}) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [matchMode, setMatchMode] = useState<'any' | 'all'>('any');

  const { data: videos, isLoading } = useQuery(
    trpc.mux.searchVideosByTags.queryOptions(
      {
        libraryId,
        tagIds: selectedTags,
        matchMode,
        limit: 50,
      },
      { enabled: selectedTags.length > 0 }
    )
  );

  return (
    <div>
      <div className="space-y-4">
        <div>
          <label>Match Mode</label>
          <select 
            value={matchMode}
            onChange={(e) => setMatchMode(e.target.value as 'any' | 'all')}
          >
            <option value="any">Any Tag (OR)</option>
            <option value="all">All Tags (AND)</option>
          </select>
          <p className="text-sm text-muted-foreground">
            {matchMode === 'any' 
              ? 'Find videos with at least one selected tag'
              : 'Find videos with all selected tags'}
          </p>
        </div>

        {videos && (
          <div>
            <p className="text-sm font-medium">
              Found {videos.length} video{videos.length !== 1 ? 's' : ''}
            </p>
            {videos.map((video) => (
              <div key={video.id} className="border p-4 rounded">
                <h3>{video.title}</h3>
                <p>{video.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Tag Statistics and Analysis

```tsx
import { useQuery } from '@tanstack/react-query';
import { trpc } from '../lib/trpc-client';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';

function TagStatistics({ libraryId }: { libraryId: string }) {
  const { data: stats } = useQuery(
    trpc.mux.getTagStatistics.queryOptions({
      libraryId,
    })
  );

  if (!stats) return <div>Loading...</div>;

  // Filter out inactive tags and get top 10
  const chartData = stats
    .slice(0, 10)
    .map(stat => ({
      name: stat.tagName,
      count: stat.videoCount,
    }));

  return (
    <div>
      <h2>Tag Usage Statistics</h2>
      <BarChart width={600} height={300} data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Bar dataKey="count" fill="#8884d8" />
      </BarChart>
      
      <div className="mt-6">
        <h3>All Tags</h3>
        <ul>
          {stats.map(stat => (
            <li key={stat.tagId}>
              <strong>{stat.tagName}</strong> - {stat.videoCount} video{stat.videoCount !== 1 ? 's' : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

### Bulk Tag Operations

```typescript
// Archive unused tags
async function archiveUnusedTags(libraryId: string) {
  const stats = await trpc.mux.getTagStatistics.query({
    libraryId,
  });

  const unusedTags = stats.filter(s => s.videoCount === 0);

  for (const tag of unusedTags) {
    await trpc.mux.updateTag.mutate({
      tagId: tag.tagId,
      isActive: false, // Deactivate instead of delete
    });
  }

  return `Archived ${unusedTags.length} unused tags`;
}

// Rename a tag and update all references
async function renameTag(tagId: string, newName: string) {
  // Update the tag definition
  const updated = await trpc.mux.updateTag.mutate({
    tagId,
    name: newName,
  });

  // The slug will be regenerated automatically
  return updated;
}

// Remove a tag from all videos
async function removeTagFromAllVideos(
  libraryId: string,
  tagIdToRemove: string
) {
  const videos = await trpc.mux.searchVideosByTags.query({
    libraryId,
    tagIds: [tagIdToRemove],
    matchMode: 'any',
    limit: 100,
  });

  for (const video of videos) {
    const currentTags = await trpc.mux.getVideoTags.query({
      videoId: video.id,
      libraryId,
    });

    const updatedTags = currentTags
      .filter(t => t.id !== tagIdToRemove)
      .map(t => t.id);

    await trpc.mux.setVideoTags.mutate({
      videoId: video.id,
      libraryId,
      tagIds: updatedTags,
    });
  }
}
```

---

## Related Documentation

- [Mux Router API](./mux-router.md) - Complete API reference
- [Tag Management](./mux-router-tags.md) - Detailed tag procedures
- [tRPC Client Setup](./trpc-setup.md) - Client configuration
- [Video Player Integration](./video-player.md) - Player examples
- [Best Practices](./best-practices.md) - Implementation guidelines
