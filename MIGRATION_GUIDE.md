# Mux Router Refactoring - Migration Guide

## Overview
The monolithic `mux.ts` file has been refactored into modular router files organized by domain. This improves code maintainability while keeping the frontend API unchanged using the flat namespace pattern.

## New Directory Structure

```
worker/trpc/routers/mux/
├── index.ts              # Main barrel export (re-exports using spread operator)
├── shared.ts            # Shared utilities, types, and helpers
├── libraries.ts         # Library CRUD operations
├── videos.ts            # Video management & synchronization
├── uploads.ts           # Direct uploads & playback IDs
├── captions.ts          # Caption/subtitle management
├── playback.ts          # Playback policies & signed tokens
├── chapters.ts          # Chapter management
├── tags.ts              # Tag management
└── playlists.ts         # Playlist management
```

## Files Created

### `shared.ts` ✅ COMPLETE
Contains all shared utilities needed across routers:
- **Types**: `MuxAsset`, `MuxTrack`, `DirectUpload`, `ThumbnailParams`
- **Constants**: `LANGUAGE_NAMES`
- **Database utilities**: `getVideosDb()`
- **Encryption**: `encryptLibraryCredentials()`, `decryptLibraryCredentials()`
- **Client management**: `getMuxLibrary()`, `getMuxClient()`
- **Token generation**: `generateSignedTokens()`
- **Helpers**: `mapMuxAssetToVideo()`, `createTagSlug()`, `getLanguageName()`

### `libraries.ts` ✅ COMPLETE
Library management procedures:
- `listLibraries` - List all active libraries
- `getLibrary` - Get specific library by ID
- `createLibrary` - Create new Mux library
- `updateLibrary` - Update library configuration
- `deleteLibrary` - Delete a library
- `testLibraryCredentials` - Verify credentials work

### `index.ts` ✅ COMPLETE
Main barrel export that combines all routers using the spread pattern:
```typescript
export const muxRouter = t.router({
	...librariesRouter.getShape(),
	...videosRouter.getShape(),
	// ... etc
});
```

This maintains the flat namespace for frontend compatibility.

## Files Needing Completion

The following files have been created with TODO comments. Copy the corresponding procedures from the original `mux.ts`:

### `videos.ts` - 14 procedures
- `listAssets` (line 749)
- `getAsset` (line 829)
- `updateAsset` (line 852)
- `updateVideoMetadata` (line 891)
- `getVideoFromDatabase` (line 968)
- `getVideoTracks` (line 1020)
- `getVideoSyncStatus` (line 1078)
- `syncSingleAsset` (line 1115)
- `deleteAsset` (line 1244)
- `listVideosFromDatabase` (line 2212)
- `getVideoById` (line 2298)
- `updateVideoById` (line 2392)
- `deleteVideoById` (line 3062)
- `syncMuxAssets` (line 1764)
- `getAssetViewCount` (line 1931)

### `uploads.ts` - 3 procedures
- `createDirectUpload` (line 1279)
- `getDirectUpload` (line 1369)
- `createPlaybackId` (line 1398)

### `captions.ts` - 3 procedures
- `addCaption` (line 1438)
- `deleteCaption` (line 1485)
- `generateCaptions` (line 1515)

### `playback.ts` - 3 procedures
- `generateSignedTokens` (line 1671)
- `createSignedUrl` (line 1719)
- `getAssetsByCollection` (line 1643)

### `chapters.ts` - 3 procedures
- `getChapters` (line 2062)
- `saveChapters` (line 2110)
- `deleteChapter` (line 2191)

### `tags.ts` - 8 procedures
- `listTags` (line 2484)
- `createTag` (line 2518)
- `updateTag` (line 2573)
- `deleteTag` (line 2630)
- `setVideoTags` (line 2661)
- `getVideoTags` (line 2759)
- `searchVideosByTags` (line 2806)
- `getTagStatistics` (line 2905)

### `playlists.ts` - 11 procedures
- `createPlaylist` (line 3122)
- `listPlaylists` (line 3248)
- `getPlaylist` (line 3384)
- `updatePlaylist` (line 3505)
- `setPlaylistPublishStatus` (line 3629)
- `deletePlaylist` (line 3685)
- `addVideoToPlaylist` (line 3740)
- `removeVideoFromPlaylist` (line 3875)
- `reorderPlaylistVideos` (line 3939)
- `updatePlaylistItem` (line 4007)
- `reorderPlaylists` (line 4094)

## Migration Steps

1. **✅ Verify shared utilities are correct** - Already done in `shared.ts`
2. **✅ Verify libraries router** - Already complete
3. **Copy procedures from original `mux.ts`** to their respective router files:
   - Update imports to use shared utilities from `./shared`
   - Each router file has a TODO comment with line numbers from original file
4. **Test in temporary branch** - Ensure all procedures work correctly
5. **Update imports in main router** - If the import path for `muxRouter` has changed
6. **Remove or archive old `mux.ts`** - After verification

## Frontend Compatibility

**No frontend changes required!** The spread operator pattern maintains the flat namespace:

```typescript
// These calls remain unchanged
trpc.mux.listLibraries.query()
trpc.mux.listAssets.query()
trpc.mux.createPlaylist.mutation()
// ... etc
```

## Import Changes for the Main Router

Update the main tRPC router initialization:

**Before:**
```typescript
import { muxRouter } from "./routers/mux";

export const appRouter = t.router({
	mux: muxRouter,
	// ...
});
```

**After:**
```typescript
import { muxRouter } from "./routers/mux"; // Now imports from mux/index.ts

export const appRouter = t.router({
	mux: muxRouter,
	// ...
});
```

The import path works the same way - Node.js/TypeScript will automatically resolve `./routers/mux` to `./routers/mux/index.ts`.

## Benefits

✅ **Improved maintainability** - Each router handles a specific domain  
✅ **Easier to navigate** - Files are 200-400 lines instead of 4100+  
✅ **Better code organization** - Related procedures grouped together  
✅ **Easier to test** - Can unit test individual routers  
✅ **No frontend changes** - Uses flat namespace pattern for backward compatibility  
✅ **Zero performance impact** - All bundled at build time  

## Next Steps

1. Copy the remaining 45 procedures from `mux.ts` into their respective router files
2. Verify all imports are correct (especially imports from `./shared`)
3. Run tests to ensure everything works
4. Once verified, delete the original `mux.ts` file
5. Commit the refactored code
