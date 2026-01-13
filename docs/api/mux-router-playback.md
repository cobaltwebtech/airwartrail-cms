# Mux Router - Playback Management

Playback ID and signed URL generation procedures.

---

## `mux.createPlaybackId`

Create a new playback ID for an asset.

**Type**: `mutation`  
**Auth**: Protected

**Input**:
```typescript
{
  assetId: string;
  libraryId?: string;
  policy?: 'public' | 'signed';  // Default: 'public'
}
```

**Output**:
```typescript
{
  playbackId: string;
  policy: string;
}
```

**Example**:
```typescript
const playback = await trpc.mux.createPlaybackId.mutate({
  assetId: 'asset_123',
  libraryId: 'lib_abc',
  policy: 'signed',
});

console.log(playback.playbackId); // Use for video player
```

---

## `mux.generateSignedTokens`

Generate signed tokens for secure video playback.

**Type**: `query`  
**Auth**: Protected

**Input**:
```typescript
{
  playbackId: string;
  libraryId?: string;
  expiresIn?: number;           // Seconds, default: 3600
  thumbnailParams?: {
    time?: number;              // Thumbnail time in seconds
    width?: number;
    height?: number;
    fit_mode?: string;
  };
}
```

**Output**:
```typescript
{
  playback: string;    // JWT for video playback
  thumbnail: string;   // JWT for thumbnail
  storyboard: string;  // JWT for storyboard
}
```

**Example**:
```typescript
const tokens = await trpc.mux.generateSignedTokens.query({
  playbackId: 'abc123',
  libraryId: 'lib_xyz',
  expiresIn: 7200, // 2 hours
  thumbnailParams: {
    time: 10,
    width: 1280,
    height: 720,
  },
});

// Use tokens in video player
const streamUrl = `https://stream.mux.com/${playbackId}.m3u8?token=${tokens.playback}`;
const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?token=${tokens.thumbnail}`;
```

---

## `mux.createSignedUrl`

Create a signed playback URL.

**Type**: `query`  
**Auth**: Protected

**Input**:
```typescript
{
  playbackId: string;
  libraryId?: string;
  expiresIn?: number;  // Default: 3600
}
```

**Output**:
```typescript
{
  url: string;
  token?: string;  // Only for signed playback
}
```

**Example**:
```typescript
const signedUrl = await trpc.mux.createSignedUrl.query({
  playbackId: 'abc123',
  libraryId: 'lib_xyz',
  expiresIn: 3600,
});

// Use in video player
<video src={signedUrl.url} controls />
```

---

## Playback Policies

### Public Playback

- No token required
- Anyone with the playback ID can view
- Suitable for public content
- URLs: `https://stream.mux.com/{playbackId}.m3u8`

### Signed Playback

- JWT token required
- Time-limited access
- Must generate tokens for each viewer
- URLs: `https://stream.mux.com/{playbackId}.m3u8?token={jwt}`

---

## Related Documentation

- [Video Player Integration](./video-player.md) - Using tokens in players
- [Usage Examples](./usage-examples.md#handling-signed-playback)
- [Mux Router Overview](./mux-router.md)
