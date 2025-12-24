import { t } from "./trpc-init";
import { bunnyRouter } from "./routers/bunny";

export const appRouter = t.router({
	bunny: bunnyRouter,
});

export type AppRouter = typeof appRouter;
