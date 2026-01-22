import { t } from "../../trpc-init";
import { librariesRouter } from "./libraries";
import { videosRouter } from "./videos";
import { uploadsRouter } from "./uploads";
import { captionsRouter } from "./captions";
import { playbackRouter } from "./playback";
import { chaptersRouter } from "./chapters";
import { tagsRouter } from "./tags";
import { playlistsRouter } from "./playlists";
import { thumbnailsRouter } from "./thumbnails";

/**
 * Main Mux router combining all domain-specific routers
 * Uses the flat namespace pattern to maintain backward compatibility with frontend
 * 
 * All procedures remain accessible at the same path:
 * - trpc.mux.listLibraries (from libraries router)
 * - trpc.mux.listAssets (from videos router)
 * - etc.
 */
export const muxRouter = t.router({
	...librariesRouter._def.record,
	...videosRouter._def.record,
	...uploadsRouter._def.record,
	...captionsRouter._def.record,
	...playbackRouter._def.record,
	...chaptersRouter._def.record,
	...tagsRouter._def.record,
	...playlistsRouter._def.record,
	...thumbnailsRouter._def.record,
});
