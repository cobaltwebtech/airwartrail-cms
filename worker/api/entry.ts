import { Hono } from "hono";
import { cors } from "hono/cors";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/worker/trpc/router";
import { createContext } from "@/worker/trpc/context";
import { auth } from "@/lib/auth-server";
import { muxWebhookRouter } from "@/worker/api/webhooks/mux";
import { imageDownloadRouter } from "@/worker/api/cf-images/download";
import { trpcCacheMiddleware } from "@/worker/middleware/trpc-cache";

export const App = new Hono<{ Bindings: Env }>();

// CORS middleware for Better Auth routes
App.use(
  "/api/auth/*",
  cors({
    origin: (origin) => origin, // Allow the requesting origin
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

// Better Auth handler
App.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

// Mux webhook handler (no auth required - uses signature verification)
App.route("/api/webhooks/mux", muxWebhookRouter);

// Image download handler (auth handled inside router)
App.route("/api/cf-images/download", imageDownloadRouter);

// tRPC: Layer 1 — Authentication
//
// getSession() resolves BOTH cookie sessions and API-key sessions when
// `enableSessionForAPIKeys: true` (see auth-server.ts). One call is enough.
App.use("/trpc/*", async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});

// tRPC: Layer 2 — Edge cache (MUST run after auth)
//
// Caches allow-listed public GET procedures at the Cloudflare edge.
// Cache key is the bare URL — auth headers are excluded by construction.
App.use("/trpc/*", trpcCacheMiddleware);

App.all("/trpc/*", (c) => {
  return fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: () =>
      createContext({
        req: c.req.raw,
        env: c.env,
        workerCtx: c.executionCtx as ExecutionContext,
      }),
  });
});