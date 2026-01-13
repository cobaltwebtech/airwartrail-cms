import { t } from "./trpc-init";
import { muxRouter } from "./routers/mux";
import { apiKeysRouter } from "./routers/api-keys";

export const appRouter = t.router({
	mux: muxRouter,
	apiKeys: apiKeysRouter,
});

export type AppRouter = typeof appRouter;
