# Mux Router - Playlist Management

Playlist management procedures.

## Core Procedures

- `mux.createPlaylist` - Create new playlist
- `mux.listPlaylists` - List all playlists with optional filters
- `mux.getPlaylist` - Get playlist by ID or slug (with videos)
- `mux.updatePlaylist` - Update playlist metadata
- `mux.setPlaylistPublishStatus` - Publish/unpublish playlist
- `mux.deletePlaylist` - Soft-delete playlist

## Video Management

- `mux.addVideoToPlaylist` - Add video (max 50 per playlist)
- `mux.removeVideoFromPlaylist` - Remove video
- `mux.reorderPlaylistVideos` - Reorder videos by array of IDs
- `mux.updatePlaylistItem` - Update custom title/description

## Ordering

- `mux.reorderPlaylists` - Reorder playlists within library

## Playlist Categories

- `featured` - Featured content
- `interviews` - Interview series
- `series` - Video series
- `short-form` - Short-form content
- `other` - Other categories

## Example: Create and Populate Playlist

```typescript
// Create playlist
const playlist = await trpc.mux.createPlaylist.mutate({
  libraryId: 'lib_123',
  name: 'Getting Started',
  slug: 'getting-started',
  category: 'series',
});

// Add videos
await trpc.mux.addVideoToPlaylist.mutate({
  playlistId: playlist.id,
  libraryId: 'lib_123',
  videoId: 'video_1',
});

// Publish
await trpc.mux.setPlaylistPublishStatus.mutate({
  playlistId: playlist.id,
  libraryId: 'lib_123',
  isPublished: true,
});
```

Refer to original documentation (lines 1000-1350) for complete schemas and all procedures.
