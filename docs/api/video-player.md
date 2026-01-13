# Mux Video Player Integration

This guide shows how to integrate Mux video playback into your application.

---

## Mux Player React

The recommended way to play Mux videos in React applications.

### Installation

```bash
pnpm add @mux/mux-player-react
```

### Basic Usage

```tsx
import MuxPlayer from '@mux/mux-player-react';

function VideoPlayer({ playbackId }: { playbackId: string }) {
  return (
    <MuxPlayer
      playbackId={playbackId}
      metadata={{
        video_title: 'My Video',
      }}
    />
  );
}
```

---

## Signed Playback

For videos with `policy: 'signed'`, you need to generate and provide tokens:

```tsx
import { useQuery } from '@tanstack/react-query';
import MuxPlayer from '@mux/mux-player-react';
import { trpc } from '../lib/trpc-client';

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
    <MuxPlayer
      playbackId={playbackId}
      tokens={{
        playback: tokens.playback,
        thumbnail: tokens.thumbnail,
        storyboard: tokens.storyboard,
      }}
      metadata={{
        video_title: 'My Video',
      }}
    />
  );
}
```

---

## Video Player with Full Controls

```tsx
import MuxPlayer from '@mux/mux-player-react';

function FullVideoPlayer({ video }: { video: Video }) {
  return (
    <MuxPlayer
      playbackId={video.playbackId}
      tokens={video.policy === 'signed' ? {
        playback: video.playbackToken,
      } : undefined}
      metadata={{
        video_id: video.id,
        video_title: video.title,
      }}
      streamType="on-demand"
      autoPlay={false}
      muted={false}
      controls
      // Enable captions
      defaultShowCaptions={true}
      // Custom poster (thumbnail)
      poster={`https://image.mux.com/${video.playbackId}/thumbnail.jpg?time=0`}
      // Responsive sizing
      style={{ aspectRatio: video.aspectRatio || '16/9' }}
    />
  );
}
```

---

## Thumbnail URLs

### Basic Thumbnail

```typescript
const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
```

### With Options

```typescript
const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=10&width=640&height=360`;
```

**Available parameters**:
- `time` - Frame time in seconds
- `width` - Thumbnail width in pixels
- `height` - Thumbnail height in pixels
- `fit_mode` - `preserve`, `stretch`, `crop`, `smartcrop`, `pad`

### Signed Thumbnail

For videos with signed playback policy:

```typescript
const { data: tokens } = await trpc.mux.generateSignedTokens.query({
  playbackId,
  libraryId,
  thumbnailParams: {
    time: 10,
    width: 1280,
    height: 720,
  },
});

const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?token=${tokens.thumbnail}`;
```

---

## Storyboard/Preview Thumbnails

Storyboards provide hover-preview thumbnails for the scrub bar:

```tsx
<MuxPlayer
  playbackId={playbackId}
  // Storyboard is automatically loaded from:
  // https://image.mux.com/${playbackId}/storyboard.vtt
/>
```

For signed playback:

```typescript
const storyboardUrl = `https://image.mux.com/${playbackId}/storyboard.vtt?token=${tokens.storyboard}`;
```

---

## Animated GIF Thumbnails

Create animated GIF previews:

```typescript
const gifUrl = `https://image.mux.com/${playbackId}/animated.gif?start=0&end=5`;
```

**Parameters**:
- `start` - Start time in seconds
- `end` - End time in seconds
- `width` - Width in pixels
- `fps` - Frames per second (1-15)

---

## Custom Video Player (Native HTML5)

If you prefer not to use Mux Player:

### Public Playback

```tsx
function CustomPlayer({ playbackId }: { playbackId: string }) {
  const hlsUrl = `https://stream.mux.com/${playbackId}.m3u8`;
  
  return (
    <video
      controls
      src={hlsUrl}
      poster={`https://image.mux.com/${playbackId}/thumbnail.jpg`}
    />
  );
}
```

### Signed Playback

```tsx
function SignedCustomPlayer({ playbackId, libraryId }: Props) {
  const { data: signedUrl } = useQuery(
    trpc.mux.createSignedUrl.queryOptions({
      playbackId,
      libraryId,
      expiresIn: 3600,
    })
  );

  if (!signedUrl) return null;

  return (
    <video
      controls
      src={signedUrl.url}
    />
  );
}
```

---

## HLS.js for Advanced Control

For more control over HLS playback:

```bash
pnpm add hls.js
```

```tsx
import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

function HLSPlayer({ playbackId, token }: { playbackId: string; token?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const hlsUrl = token
      ? `https://stream.mux.com/${playbackId}.m3u8?token=${token}`
      : `https://stream.mux.com/${playbackId}.m3u8`;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(hlsUrl);
      hls.attachMedia(videoRef.current);
      
      return () => hls.destroy();
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      videoRef.current.src = hlsUrl;
    }
  }, [playbackId, token]);

  return <video ref={videoRef} controls />;
}
```

---

## Video with Chapters

Display chapters alongside the video:

```tsx
function VideoWithChapters({ videoId, libraryId }: Props) {
  const { data: video } = useQuery(
    trpc.mux.getVideoById.queryOptions({ videoId, libraryId })
  );
  
  const { data: chapters } = useQuery(
    trpc.mux.getChapters.queryOptions({ videoId, libraryId })
  );

  const playerRef = useRef<HTMLVideoElement>(null);

  const seekToChapter = (startTime: number) => {
    if (playerRef.current) {
      playerRef.current.currentTime = startTime;
      playerRef.current.play();
    }
  };

  return (
    <div>
      <MuxPlayer
        ref={playerRef}
        playbackId={video?.playbackId}
      />
      
      <div>
        <h3>Chapters</h3>
        {chapters?.map((chapter) => (
          <button
            key={chapter.id}
            onClick={() => seekToChapter(chapter.startTime)}
          >
            {chapter.title} ({chapter.startTime}s)
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## Related Documentation

- [Mux Router API](./mux-router.md) - Fetching video data and tokens
- [Usage Examples](./usage-examples.md) - More video player examples
- [Types](./types.md) - Video and playback types

---

## External Resources

- [Mux Player React Docs](https://docs.mux.com/guides/video/mux-player)
- [Mux Image API](https://docs.mux.com/guides/video/get-images-from-a-video)
- [HLS.js Documentation](https://github.com/video-dev/hls.js/)
