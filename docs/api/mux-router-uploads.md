# Mux Router - Upload Management

Direct upload procedures for resumable video uploads.

---

## `mux.createDirectUpload`

Create a direct upload URL for resumable uploads.

**Type**: `mutation`  
**Auth**: Protected

**Input**:
```typescript
{
  libraryId?: string;
  corsOrigin: string;                              // Required for CORS
  timeout?: number;                                // 60-604800, default: 3600
  title?: string;
  metadata?: Record<string, unknown>;
  videoQuality?: 'basic' | 'plus' | 'premium';     // Overrides library default
  playbackPolicy?: 'public' | 'signed';            // Overrides library default
  autoCaptions?: {
    enabled: boolean;
    languageCode?: 'en' | 'es' | 'it' | 'pt' | 'de' | 'fr' | ... ; // Default: 'en'
  };
}
```

**Output**:
```typescript
{
  id: string;
  url: string;         // Use this URL for PUT upload
  status: 'waiting' | 'asset_created' | 'errored' | 'cancelled' | 'timed_out';
  timeout: number;
  assetId?: string;
}
```

**Example**:
```typescript
const upload = await trpc.mux.createDirectUpload.mutate({
  libraryId: 'lib_123',
  corsOrigin: 'https://myapp.com',
  title: 'My Video',
  autoCaptions: {
    enabled: true,
    languageCode: 'en',
  },
});

// Upload the file using PUT
await fetch(upload.url, {
  method: 'PUT',
  body: videoFile,
  headers: {
    'Content-Type': 'video/mp4',
  },
});
```

---

## `mux.getDirectUpload`

Get upload status.

**Type**: `query`  
**Auth**: Protected

**Input**:
```typescript
{
  uploadId: string;
  libraryId?: string;
}
```

**Output**: `DirectUpload` object with current status

**Example**:
```typescript
const status = await trpc.mux.getDirectUpload.query({
  uploadId: 'upload_123',
  libraryId: 'lib_abc',
});

console.log(status.status); // 'waiting' | 'asset_created' | ...
```

---

## Upload Workflow

1. **Create upload URL** - Call `createDirectUpload`
2. **Upload file** - PUT request to the returned URL
3. **Poll for completion** - Call `getDirectUpload` until status is `asset_created`
4. **Sync to database** - Call `syncSingleAsset` with the `assetId`

---

## Related Documentation

- [Usage Examples](./usage-examples.md#uploading-videos) - Complete upload example
- [Mux Router Overview](./mux-router.md)
- [Types](./types.md) - DirectUpload type
