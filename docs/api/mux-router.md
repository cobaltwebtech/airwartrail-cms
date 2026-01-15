# Mux Router API

The `mux` router handles all video-related operations including libraries, videos, tracks, chapters, and playlists.

---

## Quick Navigation

- **[Libraries](./mux-router-libraries.md)** - Library management
- **[Videos](./mux-router-videos.md)** - Video asset management
- **[Tags](./mux-router-tags.md)** - Tag management and video search by tags
- **[Uploads](./mux-router-uploads.md)** - Direct upload procedures
- **[Captions & Tracks](./mux-router-captions.md)** - Caption and track management
- **[Playback](./mux-router-playback.md)** - Playback IDs and signed URLs
- **[Chapters](./mux-router-chapters.md)** - Video chapter management
- **[Analytics](./mux-router-analytics.md)** - View counts and analytics
- **[Playlists](./mux-router-playlists.md)** - Playlist management

---

## Router Structure

```typescript
muxRouter = {
  // Libraries
  listLibraries,
  getLibrary,
  createLibrary,
  updateLibrary,
  deleteLibrary,
  testLibraryCredentials,
  
  // Videos
  listAssets,
  listVideosFromDatabase,
  getAsset,
  getVideoById,
  getVideoFromDatabase,
  getVideoSyncStatus,
  syncSingleAsset,
  syncMuxAssets,
  updateAsset,
  updateVideoMetadata,
  updateVideoById,
  updatePlaybackPolicy,
  deleteAsset,
  deleteVideoById,
  
  // Tags
  listTags,
  createTag,
  updateTag,
  deleteTag,
  setVideoTags,
  getVideoTags,
  searchVideosByTags,
  getTagStatistics,
  
  // Uploads
  createDirectUpload,
  getDirectUpload,
  
  // Captions & Tracks
  getVideoTracks,
  addCaption,
  deleteCaption,
  generateCaptions,
  
  // Playback
  createPlaybackId,
  generateSignedTokens,
  createSignedUrl,
  
  // Chapters
  getChapters,
  saveChapters,
  deleteChapter,
  
  // Analytics
  getAssetViewCount,
  
  // Playlists
  createPlaylist,
  listPlaylists,
  getPlaylist,
  updatePlaylist,
  setPlaylistPublishStatus,
  deletePlaylist,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  reorderPlaylistVideos,
  updatePlaylistItem,
  reorderPlaylists,
}
```

---

## Common Parameters

Most procedures accept these common parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `libraryId` | `string` | Library ID (optional if default library exists) |
| `muxAssetId` | `string` | Mux asset identifier |
| `videoId` | `string` | Internal database video ID |
| `playbackId` | `string` | Mux playback identifier |

---

## Authentication

All procedures in the Mux router require authentication via:
- Session cookie (browser requests)
- API key header `x-api-key: awt_xxx` (server requests)

See [Authentication](./authentication.md) for details.

---

## Related Documentation

- [Types](./types.md) - Type definitions for all Mux entities
- [Error Handling](./error-handling.md) - Error codes and handling
- [Usage Examples](./usage-examples.md) - Practical implementation examples
