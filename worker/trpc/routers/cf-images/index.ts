import { t } from "../../trpc-init";
import { cfApiRouter } from "./cf-api";
import { imagesDbRouter } from "./images";
import { albumsRouter } from "./albums";
import { albumImagesRouter } from "./album-images";
import { signedUrlsRouter } from "./signed-urls";

/**
 * Main CF Images router with nested sub-routers.
 *
 *   trpc.cfImages.api.uploadViaUrl
 *   trpc.cfImages.images.listImages
 *   trpc.cfImages.albums.createAlbum
 *   trpc.cfImages.albumImages.addImageToAlbum
 *   trpc.cfImages.signedUrls.signUrl
 */
export const cfImagesRouter = t.router({
	api: cfApiRouter,
	images: imagesDbRouter,
	albums: albumsRouter,
	albumImages: albumImagesRouter,
	signedUrls: signedUrlsRouter,
});
