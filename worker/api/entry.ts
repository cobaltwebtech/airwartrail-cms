import { Hono } from "hono";
import { cors } from "hono/cors";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/worker/trpc/router";
import { createContext } from "@/worker/trpc/context";
import { auth } from "@/lib/auth-server";
import { muxWebhookRouter } from "@/worker/api/webhooks/mux";
import { imageDownloadRouter } from "@/worker/api/cf-images/download";

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

App.use("/trpc/*", async (c, next) => {
  // Check for API key in header first
  const apiKey = c.req.header('x-api-key');
  
  // Better Auth's getSession handles both cookie sessions and API key sessions
  // when enableSessionForAPIKeys is enabled in the apiKey plugin
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  // Allow access if either session cookie or API key is valid
  if (!session && !apiKey) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // If API key is provided but session is null, verify the API key directly
  if (!session && apiKey) {
    try {
      const verifyResult = await auth.api.verifyApiKey({
        body: { key: apiKey },
      });
      if (!verifyResult.valid) {
        return c.json({ error: "Invalid API key" }, 401);
      }
    } catch {
      return c.json({ error: "Invalid API key" }, 401);
    }
  }

  await next();
});

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