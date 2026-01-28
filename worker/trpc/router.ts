import { t } from "./trpc-init";
import { muxRouter } from "./routers/mux";
import { apiKeysRouter } from "./routers/api-key";
import { blogRouter } from "./routers/blog";

export const appRouter = t.router({
	mux: muxRouter,
	apiKeys: apiKeysRouter,
	blog: blogRouter,
});

export type AppRouter = typeof appRouter;
