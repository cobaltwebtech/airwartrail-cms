import { Hono } from "hono";
import { cors } from "hono/cors";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/worker/trpc/router";
import { createContext } from "@/worker/trpc/context";
import { auth } from "@/lib/auth-server";

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