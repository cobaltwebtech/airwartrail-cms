import { t } from "./trpc-init";
import { muxRouter } from "./routers/mux";
import { apiKeysRouter } from "./routers/api-key";
import { blogRouter } from "./routers/blog";
import { cfImagesRouter } from "./routers/cf-images";

export const appRouter = t.router({
	mux: muxRouter,
	apiKeys: apiKeysRouter,
	blog: blogRouter,
	cfImages: cfImagesRouter,
});

export type AppRouter = typeof appRouter;
