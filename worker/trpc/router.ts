import { t } from "./trpc-init";
import { muxRouter } from "./routers/mux";

export const appRouter = t.router({
	mux: muxRouter,
});

export type AppRouter = typeof appRouter;
