import { t } from "./trpc-init";
import { muxRouter } from "./routers/mux";
import { apiKeysRouter } from "./routers/api-key";
import { blogRouter } from "./routers/blog";
import { pagesRouter } from "./routers/pages";
import { cfImagesRouter } from "./routers/cf-images";
import { documentsRouter } from "./routers/documents";

export const appRouter = t.router({
	mux: muxRouter,
	apiKeys: apiKeysRouter,
	blog: blogRouter,
	pages: pagesRouter,
	cfImages: cfImagesRouter,
	documents: documentsRouter,
});

export type AppRouter = typeof appRouter;
