# Mux Thumbnail Generation and Rendering

This document covers how to generate and render video thumbnails using the `VideoThumbnail` component and helper functions in AirWarTrail. The system supports both **public** and **signed** playback policies with automatic token management.

---

## Overview

Mux provides image generation for videos through their image API. Our implementation includes:

- **`VideoThumbnail` Component** - React component that handles thumbnail rendering with automatic signed token fetching
- **Helper Functions** - Utility functions for generating thumbnail URLs with support for both public and signed playback policies
- **Automatic Policy Detection** - The component automatically determines which URL format to use based on the playback policy

---

## Architecture

### Public vs Signed Playback

| Aspect | Public Policy | Signed Policy |
|--------|---------------|---------------|
| URL Parameters | Query strings (time, width, height, fit_mode) | JWT token only (params in JWT claims) |
| Security | Suitable for public videos | Required for restricted content |
| Token Required | None | Yes, via tRPC |
| Caching Strategy | Simple query-based | Token-based with 1-hour TTL |

---

## Helper Functions

Located in [src/lib/video-helpers.ts](../../src/lib/video-helpers.ts)

### `getMuxThumbnailUrl()`

Main function that generates Mux thumbnail URLs. Automatically handles both public and signed policies.

```typescript
function getMuxThumbnailUrl(
  playbackId: string | null | undefined,
  options: MuxThumbnailOptions = {},
  token?: string | null,
): string | null
```

**Parameters:**
- `playbackId` - The Mux playback ID for the video
- `options` - Configuration options (width, height, time, fitMode, format)
- `token` - Optional signed JWT token (if provided, creates a signed URL)

**Returns:** The thumbnail URL or null

**Example:**
```typescript
// Public video
const publicUrl = getMuxThumbnailUrl('abc123', {
  width: 640,
  height: 360,
  time: 10,
  fitMode: 'smartcrop',
});
// Returns: https://image.mux.com/abc123/thumbnail.webp?width=640&height=360&time=10&fit_mode=smartcrop

// Signed video
const signedUrl = getMuxThumbnailUrl('abc123', {}, 'eyJhbGciOiJSUzI1NiIs...');
// Returns: https://image.mux.com/abc123/thumbnail.webp?token=eyJhbGciOiJSUzI1NiIs...
```

### `getPublicThumbnailUrl()`

Generates URLs for public playback policy videos. Parameters are passed as query strings.

```typescript
function getPublicThumbnailUrl(
  playbackId: string | null | undefined,
  options: MuxThumbnailOptions = {},
): string | null
```

**When to use:** For videos with public playback policy where parameters can be exposed in the URL.

### `getSignedThumbnailUrl()`

Generates URLs for signed playback policy videos. Only the token is included in the query string; parameters must be embedded in the JWT token claims.

```typescript
function getSignedThumbnailUrl(
  playbackId: string | null | undefined,
  token: string | null | undefined,
  format?: 'png' | 'jpg' | 'webp',
): string | null
```

**Important:** This function expects parameters (time, width, height, fit_mode) to already be encoded in the JWT token. Do not pass additional query parameters.

**When to use:** For videos with signed playback policy requiring authentication.

### `getDefaultThumbnailDimensions()`

Returns sensible default dimensions based on aspect ratio preference.

```typescript
function getDefaultThumbnailDimensions(aspectVideo?: boolean): {
  width: number;
  height: number;
}
```

**Returns:**
- `aspectVideo: true` → 640x360 (16:9)
- `aspectVideo: false` → 160x90 (16:9 thumbnail)

**Example:**
```typescript
const { width, height } = getDefaultThumbnailDimensions(true);
// { width: 640, height: 360 }
```

---

## MuxThumbnailOptions Interface

Configuration options for thumbnail generation:

```typescript
interface MuxThumbnailOptions {
  /** Width in pixels */
  width?: number;
  
  /** Height in pixels */
  height?: number;
  
  /** Time in seconds to capture the thumbnail from */
  time?: number;
  
  /** How to fit the image within the dimensions */
  fitMode?: 'preserve' | 'stretch' | 'crop' | 'smartcrop' | 'pad';
  
  /** Output format */
  format?: 'png' | 'jpg' | 'webp';
}
```

**Fit Mode Explanations:**
- `smartcrop` - Automatically crops to the most interesting part (recommended)
- `preserve` - Maintains aspect ratio, adds letterboxing if needed
- `crop` - Crops to exact dimensions without maintaining aspect ratio
- `stretch` - Stretches to exact dimensions
- `pad` - Adds padding to maintain aspect ratio

---

## VideoThumbnail Component

A React component that handles rendering video thumbnails with automatic token fetching for signed videos.

Located in [src/components/VideoThumbnail.tsx](../../src/components/VideoThumbnail.tsx)

### Props

```typescript
interface VideoThumbnailProps {
  /** The Mux playback ID for the video */
  playbackId: string | null | undefined;
  
  /** Alt text for the image */
  alt: string;
  
  /** Additional CSS classes for the image */
  className?: string;
  
  /** Whether to use 16:9 aspect ratio (640x360) instead of compact (160x90) */
  aspectVideo?: boolean;
  
  /** Custom width in pixels (overrides aspectVideo) */
  width?: number;
  
  /** Custom height in pixels (overrides aspectVideo) */
  height?: number;
  
  /** Playback policy - determines if signed token is required */
  policy?: 'public' | 'signed';
  
  /** Library ID - required for signed policy to fetch token */
  libraryId?: string;
  
  /** Time in seconds to capture the thumbnail from */
  time?: number;
  
  /** Custom fallback icon component */
  fallbackIcon?: React.ReactNode;
}
```

### Behavior

1. **Calculates dimensions** - Uses provided width/height or defaults based on `aspectVideo`
2. **For signed videos** - Fetches JWT token via tRPC with embedded thumbnail parameters
3. **Generates URL** - Uses helper functions to create the appropriate Mux image URL
4. **Renders with loading state** - Shows skeleton while loading, handles errors gracefully
5. **Caches tokens** - Signed tokens are cached for 1 hour via TanStack Query

### Usage Examples

#### Basic Public Thumbnail

```tsx
import { VideoThumbnail } from '@/components/VideoThumbnail';

export function VideoCard({ playbackId }: { playbackId: string }) {
  return (
    <VideoThumbnail
      playbackId={playbackId}
      alt="Video title"
      aspectVideo
    />
  );
}
```

#### Signed Thumbnail with Custom Dimensions

```tsx
<VideoThumbnail
  playbackId="abc123"
  alt="Premium video"
  policy="signed"
  libraryId="lib_456"
  width={800}
  height={450}
  time={30}
/>
```

#### With Custom Fallback Icon

```tsx
import { Video } from 'lucide-react';

<VideoThumbnail
  playbackId={playbackId}
  alt="Video"
  policy="signed"
  libraryId={libraryId}
  fallbackIcon={<Video className="size-8" />}
/>
```

#### Compact Thumbnail (160x90)

```tsx
<VideoThumbnail
  playbackId={playbackId}
  alt="Video thumbnail"
  aspectVideo={false}
/>
```

---

## How It Works

### For Public Videos

```
User Component
    ↓
VideoThumbnail checks policy='public'
    ↓
Calculates dimensions (or uses defaults)
    ↓
Calls getMuxThumbnailUrl(playbackId, { width, height, time, fitMode })
    ↓
Returns: https://image.mux.com/{playbackId}/thumbnail.webp?width=640&height=360&time=10&fit_mode=smartcrop
    ↓
Image rendered directly
```

### For Signed Videos

```
User Component
    ↓
VideoThumbnail checks policy='signed'
    ↓
TanStack Query checks if token is cached
    ↓
If not cached: calls trpc.mux.generateSignedTokens
    ↓
tRPC generates JWT token with embedded params: { time, width, height, fit_mode }
    ↓
Token cached for 1 hour (staleTime: 60 * 60 * 1000)
    ↓
Calls getMuxThumbnailUrl(playbackId, {}, token)
    ↓
Returns: https://image.mux.com/{playbackId}/thumbnail.webp?token={jwt}
    ↓
Image rendered with skeleton placeholder during loading
```

---

## Common Patterns

### Video Grid with Thumbnails

```tsx
import { VideoThumbnail } from '@/components/VideoThumbnail';

export function VideoGrid({ videos, libraryId }: VideoGridProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {videos.map((video) => (
        <div key={video.id} className="space-y-2">
          <VideoThumbnail
            playbackId={video.playbackId}
            alt={video.title}
            policy={video.playbackPolicy}
            libraryId={libraryId}
            aspectVideo
            time={video.thumbnailTime}
          />
          <h3 className="text-sm font-medium">{video.title}</h3>
        </div>
      ))}
    </div>
  );
}
```

### Responsive Thumbnails

```tsx
<VideoThumbnail
  playbackId={playbackId}
  alt="Video"
  className="rounded-lg shadow-md hover:shadow-lg transition-shadow"
  aspectVideo
  policy={playbackPolicy}
  libraryId={libraryId}
/>
```

### Thumbnail with Time Selection

```tsx
const [selectedTime, setSelectedTime] = useState(10);

<VideoThumbnail
  playbackId={playbackId}
  alt="Video"
  time={selectedTime}
  policy="signed"
  libraryId={libraryId}
  aspectVideo
/>
```

---

## Performance Considerations

### Caching Strategy

**Token Caching:**
- Signed tokens are cached for **1 hour** via TanStack Query
- Reduces unnecessary tRPC calls for the same video/parameters combination
- Tokens are lightweight (JWT) and safe to cache client-side

**Image Caching:**
- Mux thumbnails are cached by CDN
- Use different `time` values to get different cache keys
- Browser caches based on URL, so identical URLs hit browser cache

### Optimization Tips

1. **Use default dimensions when possible** - Standard sizes (640x360, 160x90) are more likely to be cached

2. **Batch token generation** - When rendering many signed thumbnails, they'll share cached tokens

3. **Avoid dynamic parameters** - If possible, use fixed time/dimensions rather than frequently changing values

4. **Lazy load thumbnails** - Use React.lazy or intersection observer for off-screen thumbnails

```tsx
// Example: Lazy load with intersection observer
const VideoThumbnailLazy = lazy(() => 
  import('@/components/VideoThumbnail')
);

<Suspense fallback={<Skeleton />}>
  <VideoThumbnailLazy {...props} />
</Suspense>
```

---

## Error Handling

### Fallback Behavior

The component handles three error states:

1. **No playbackId** - Shows fallback icon
2. **Image load fails** - Shows fallback icon
3. **Token fetch fails** - Shows skeleton indefinitely

### Custom Error States

```tsx
const [hasError, setHasError] = useState(false);

if (hasError) {
  return <div className="bg-gray-200 aspect-video flex items-center justify-center">Failed to load</div>;
}

<VideoThumbnail
  playbackId={playbackId}
  alt="Video"
  fallbackIcon={<AlertCircle className="text-destructive" />}
/>
```

---

## Signed Video Parameter Encoding

For signed videos, parameters must be embedded in the JWT token claims. The component automatically handles this:

```typescript
// Inside VideoThumbnail component
const thumbnailParams = {
  time: time,
  width: finalWidth,
  height: finalHeight,
  fit_mode: 'smartcrop' as const,
};

// These params are sent to tRPC, which includes them in the JWT
const { data: signedTokens } = useQuery(
  trpc.mux.generateSignedTokens.queryOptions({
    playbackId: playbackId ?? '',
    libraryId,
    thumbnailParams: thumbnailParams, // ← Encoded in JWT token
  }),
);
```

**Important:** Do NOT pass thumbnail parameters as query strings for signed URLs. The Mux API requires them in the token.

---

## Mux Documentation References

- [Mux Image Generation Guide](https://docs.mux.com/guides/get-images-from-a-video)
- [Mux Secure Playback](https://docs.mux.com/guides/secure-video-playback)
- [Mux Playback Policies](https://docs.mux.com/guides/playback-restrictions)

---

## Related Documentation

- [Mux Router API](./mux-router.md) - Complete video management API
- [Authentication](./authentication.md) - Token generation and auth strategies
- [Best Practices](./best-practices.md) - Implementation guidelines
- [Video Player Integration](./video-player.md) - Mux Player setup
