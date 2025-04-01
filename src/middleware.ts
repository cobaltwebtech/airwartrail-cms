import { auth } from "@/lib/auth-server";
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  // Define public paths that don't require authentication
  const publicPaths = ["/prelogin", "/login", "/signup", "/forgot-password"];
  const isPublicPath = publicPaths.includes(context.url.pathname);
  const isApiRoute = context.url.pathname.startsWith("/api/auth");

  const isAuthed = await auth.api.getSession({
    headers: context.request.headers,
  });
  if (!isPublicPath && !isAuthed && !isApiRoute) {
    return context.redirect("/prelogin");
  }
  if (isPublicPath && isAuthed) {
    return context.redirect("/");
  }
  return next();
});
