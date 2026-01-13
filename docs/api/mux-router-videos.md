# Mux Router - Video Management

Video asset management procedures for listing, syncing, updating, and deleting videos.

---

## Listing Videos

### `mux.listAssets`

List all assets directly from Mux (enriched with database metadata).

**Type**: `query`  
**Input**: `{ libraryId?: string; limit?: number; page?: number }`  
**Output**: `Array<MuxAsset>`

### `mux.listVideosFromDatabase`

**Preferred** - List videos from internal database for navigation.

**Type**: `query`  
**Input**: `{ libraryId: string; limit?: number; offset?: number }`  
**Returns**: Array of video records with internal IDs

---

## Getting Videos

### `mux.getAsset`

Get a single asset from Mux.

**Input**: `{ assetId: string; libraryId?: string }`  
**Returns**: `MuxAsset`

### `mux.getVideoById`

**Preferred** - Get video by internal database ID (combines database + Mux data).

**Input**: `{ videoId: string; libraryId: string }`  
**Returns**: Complete video object with all metadata

### `mux.getVideoFromDatabase`

Get video metadata from database only.

**Input**: `{ muxAssetId: string; libraryId?: string }`

---

## Syncing Videos

### `mux.syncSingleAsset`

Sync a single Mux asset to the local database.

**Input**: `{ muxAssetId: string; libraryId?: string }`  
**Returns**: `{ success: boolean; videoId: string }`

### `mux.syncMuxAssets`

Batch sync all assets from Mux to the local database.

**Input**: `{ libraryId?: string }`  
**Returns**: `{ synced: number; updated: number; total: number }`

### `mux.getVideoSyncStatus`

Check if a video is synced to the local database.

**Input**: `{ muxAssetId: string; libraryId?: string }`  
**Returns**: `{ isSynced: boolean; videoId?: string }`

---

## Updating Videos

### `mux.updateAsset`

Update asset metadata on Mux.

**Input**: `{ assetId: string; libraryId?: string; title?: string; metadata?: Record }`

### `mux.updateVideoMetadata`

Update video metadata in local database.

**Input**: `{ muxAssetId: string; libraryId?: string; title?: string; description?: string; isPublished?: boolean }`

### `mux.updateVideoById`

Update video by internal database ID.

**Input**: `{ videoId: string; libraryId: string; title?: string; description?: string; isPublished?: boolean }`

### `mux.updateVideoTags`

Update tags on a video.

**Input**: `{ videoId: string; libraryId: string; tags: string[] }`  
**Max**: 12 tags, each 1-32 chars, alphanumeric + : @ . _ - space

### `mux.updatePlaybackPolicy`

Change the playback policy for a video.

**Input**: `{ videoId: string; libraryId: string; playbackPolicy: 'public' | 'signed' }`  
**Returns**: `{ success: boolean; playbackId: string }`

---

## Deleting Videos

### `mux.deleteAsset`

Delete an asset from Mux and soft-delete from database.

**Input**: `{ assetId: string; libraryId?: string }`

### `mux.deleteVideoById`

Delete video by internal database ID.

**Input**: `{ videoId: string; libraryId: string }`

---

## Related Documentation

- [Mux Router Overview](./mux-router.md)
- [Types](./types.md) - MuxAsset and Video types
- [Usage Examples](./usage-examples.md)
