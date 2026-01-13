# Type Definitions

TypeScript interfaces and types used throughout the API.

---

## MuxAsset

```typescript
interface MuxAsset {
  id: string;
  playbackId: string;
  status: 'preparing' | 'ready' | 'errored';
  title: string;
  thumbnail?: string;
  duration: number;
  createdAt: string;
  updatedAt?: string;
  captions?: MuxTrack[];
  metadata?: Record<string, unknown>;
  policy?: 'public' | 'signed';
  resolutionTier?: 'audio-only' | '720p' | '1080p' | '1440p' | '2160p';
  aspectRatio?: string;
  videoQuality?: 'basic' | 'plus' | 'premium';
  maxStoredFrameRate?: number;
  maxWidth?: number;
  maxHeight?: number;
  views?: number;
  isPublished?: boolean;
}
```

---

## MuxTrack

```typescript
interface MuxTrack {
  id: string;
  type: 'text' | 'audio' | 'video';
  textType?: 'captions' | 'subtitles';
  language?: string;
  languageCode?: string;
  name?: string;
  closed_captions?: boolean;
}
```

---

## DirectUpload

```typescript
interface DirectUpload {
  id: string;
  url: string;
  status: 'waiting' | 'asset_created' | 'errored' | 'cancelled' | 'timed_out';
  timeout: number;
  assetId?: string;
}
```

---

## Video (Database Record)

```typescript
interface Video {
  id: string;              // Internal database ID
  libraryId: string;
  muxAssetId: string;
  muxPlaybackId: string | null;
  muxEnvironmentId: string | null;
  status: 'preparing' | 'ready' | 'errored';
  errorCategory: string | null;
  errorMessages: string | null;
  title: string;
  description: string | null;
  duration: number;
  aspectRatio: string | null;
  maxWidth: number | null;
  maxHeight: number | null;
  maxStoredFrameRate: number | null;
  resolutionTier: string | null;
  videoQuality: string | null;
  playbackId: string | null;
  policy: 'public' | 'signed';
  isPublished: boolean;
  publishedAt: string | null;
  views: number;
  viewCountSyncedAt: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
```

---

## Library

```typescript
interface Library {
  id: string;
  name: string;
  description: string | null;
  muxEnvironmentId: string | null;
  tokenId: string;
  signingKeyId: string | null;
  webhookSecret: string | null;
  defaultPlaybackPolicy: 'public' | 'signed';
  defaultVideoQuality: 'basic' | 'plus' | 'premium';
  isDefault: boolean;
  isActive: boolean;
  hasSigningKey: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Playlist

```typescript
interface Playlist {
  id: string;
  libraryId: string;
  name: string;
  slug: string;
  description: string | null;
  category: 'featured' | 'interviews' | 'series' | 'short-form' | 'other';
  thumbnailVideoId: string | null;
  thumbnailTime: number | null;
  thumbnailPlaybackId: string | null;
  thumbnailPolicy: 'public' | 'signed' | null;
  isPublished: boolean;
  publishedAt: Date | null;
  sortOrder: number;
  tags: string[];
  customMetadata: Record<string, unknown> | null;
  videoCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## PlaylistVideo

```typescript
interface PlaylistVideo {
  id: string;
  playlistId: string;
  videoId: string;
  sortOrder: number;
  customTitle: string | null;
  customDescription: string | null;
  addedAt: Date;
  // Joined video data
  title: string;
  description: string | null;
  muxPlaybackId: string | null;
  playbackPolicy: 'public' | 'signed' | null;
  duration: number | null;
  status: string;
  isPublished: boolean;
}
```

---

## Chapter

```typescript
interface Chapter {
  id: string;
  videoId: string;
  title: string;
  startTime: number;      // Seconds
  endTime: number | null;
  sortOrder: number;
  thumbnailTime: number | null;
}
```

---

## ApiKey

```typescript
interface ApiKey {
  id: string;
  name: string;
  start: string;                // First few chars for identification
  prefix: string;               // 'awt_'
  enabled: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastRequest: Date | null;
  requestCount: number;
  rateLimitEnabled: boolean;
  rateLimitMax: number | null;
  rateLimitTimeWindow: number | null;
  permissions: Record<string, string[]> | null;
  metadata: Record<string, unknown> | null;
}
```

---

## Permissions

```typescript
type Permissions = {
  mux?: ('read' | 'write' | 'delete')[];
  playlists?: ('read' | 'write' | 'delete')[];
  libraries?: ('read' | 'write')[];
};
```

---

## PlaybackPolicy

```typescript
type PlaybackPolicy = 'public' | 'signed';
```

---

## VideoQuality

```typescript
type VideoQuality = 'basic' | 'plus' | 'premium';
```

---

## VideoStatus

```typescript
type VideoStatus = 'preparing' | 'ready' | 'errored';
```

---

## UploadStatus

```typescript
type UploadStatus = 'waiting' | 'asset_created' | 'errored' | 'cancelled' | 'timed_out';
```

---

## Related Documentation

- [Mux Router API](./mux-router.md) - Using these types in API calls
- [API Keys Router](./api-keys-router.md) - API key types
