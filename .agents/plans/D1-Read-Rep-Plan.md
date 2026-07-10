# Plan: Adopt D1 Sessions API for global read replication (DB_VIDEOS + DB_CONTENT only)

## TL;DR
Enabling replication on the dashboard is necessary but **not sufficient**. Without changing code, every query still hits the primary D1 instance. Cloudflare requires you to call `env.DB.withSession(...)` and run all queries on that session object to actually be served by replicas with sequential consistency. Plan: add a per-request D1 `Session` for `DB_VIDEOS` and `DB_CONTENT` only, expose them through the tRPC context, refactor every `drizzle(env.DB_VIDEOS)` / `drizzle(env.DB_CONTENT)` call site to use the session, and propagate the session bookmark via an HTTP header end-to-end (frontend worker ↔ backend worker via service binding). **`DB_AUTH` and `DB_FRONTEND_AUTH` are out of scope** — Better Auth handles those, no changes there.

## Background facts
- Replication only triggers when queries are issued via `env.DB.withSession(bookmark | "first-unconstrained" | "first-primary")`. A raw `env.DB.prepare(...)` or `drizzle(env.DB)` call still goes to the primary.
- Drizzle's `drizzle-orm/d1` accepts the result of `withSession()` (it implements the same interface as `D1Database` for query execution) — confirm by passing `session as unknown as D1Database`.
- `served_by_region` / `served_by_primary` are returned in `meta` for diagnostics.
- Bookmarks are needed to preserve "read your own writes" across requests. Without forwarding a bookmark, a write followed by an immediate read on a new request can hit a stale replica.
- Service bindings (frontend worker → backend worker) execute in the same colo as the caller, so backend Sessions API selects a replica near the user — this is exactly the topology that benefits most.
- **Out of scope:** `DB_AUTH` and `DB_FRONTEND_AUTH`. Better Auth manages those and they remain on the primary; no Sessions API plumbing for them.

## Steps

### Phase 1 — Plumbing (sequential)
1. Create `worker/lib/d1-session.ts` exporting:
   - A small helper `createDbSessions(env, bookmarks)` that returns `{ videos, content }` where each is the result of `env.DB_*.withSession(bookmark ?? "first-unconstrained")`.
   - A helper `getCombinedBookmark(sessions)` that returns a serialized `{ videos, content }` JSON string (each binding's `getBookmark()`), to round-trip via one header.
2. Pick header name: `x-d1-bookmarks` (single header, JSON-encoded per binding `{ videos, content }`). Document fallback to `"first-unconstrained"` when missing.

### Phase 2 — Backend worker integration (sequential, depends on Phase 1)
3. Update `worker/trpc/context.ts`:
   - Add `db: { videos, content }` (Drizzle clients bound to per-request sessions) and `rawSessions` (so we can call `getBookmark()` after handlers).
   - Parse `x-d1-bookmarks` header in `createContext`.
4. Update `worker/api/entry.ts`:
   - Build sessions once per request and stash on the Hono context.
   - After the tRPC handler runs, read the resulting bookmarks and write `x-d1-bookmarks` onto the response.
   - **Auth middleware untouched** — Better Auth (`auth.api.getSession`) keeps using `DB_AUTH` directly. No changes to `src/lib/auth-server.ts`.
5. Refactor every `drizzle(env.DB_VIDEOS)` / `drizzle(env.DB_CONTENT)` site to receive the session-bound Drizzle client from `ctx.db.*`:
   - **DB_VIDEOS:**
     - `worker/trpc/routers/mux/shared.ts` — `getVideosDb` becomes `(ctx) => ctx.db.videos`. Audit every call site.
   - **DB_CONTENT:**
     - `worker/trpc/routers/blog/index.ts`, `pages/index.ts`, `documents/index.ts`, `cf-images/helpers.ts` — same pattern.
     - `worker/api/cf-images/download.ts` — uses Hono context, swap to per-request session built from the same header.
   - **Webhook:** `worker/api/webhooks/mux.ts` writes to `DB_VIDEOS` — use `withSession("first-primary")` here (no upstream bookmark; writes need immediate consistency for subsequent reads in the handler).
   - **Untouched:** `worker/trpc/routers/frontend-auth/index.ts` (DB_FRONTEND_AUTH), and any DB_AUTH access.

### Phase 3 — Frontend worker integration (parallel with Phase 2 step 5)
6. In the React frontend worker (separate repo/file — not in this workspace; flag for follow-up):
   - When forwarding requests via the service binding, read incoming `x-d1-bookmarks` from the user request, attach it to the outgoing `fetch(serviceBinding, ...)`, and copy the response header back to the user response (set as a cookie or non-HttpOnly header so the browser sends it back next request).
   - Recommended: use a cookie `d1_bookmarks` (HttpOnly, SameSite=Lax, short max-age e.g. 5 min) so it auto-rides on subsequent requests without frontend JS work.

### Phase 4 — Cache and procedure considerations (sequential, depends on 5)
7. Re-evaluate `worker/middleware/trpc-cache.ts`:
   - Cached responses skip the DB entirely, so they don't interact with bookmarks. But a cache HIT means we don't update `x-d1-bookmarks` on the response — that's fine; the client retains its prior bookmark.
   - Confirm no cached procedure depends on read-your-own-writes guarantees within the same request batch.
8. For known write-then-read patterns inside a single procedure (e.g., create then re-fetch), Sessions API already chains them on the same session so this is a no-op.

### Phase 5 — Verification & rollout (sequential)
9. Add temporary logging to print `meta.served_by_region` / `meta.served_by_primary` from a representative read in each router. **Note:** these fields are `undefined` in `wrangler dev` local mode — must test against `--remote` or a deployed environment.
10. **Deploy the Sessions API refactor with replication still OFF.** Per Cloudflare docs, Sessions API is safe even when replication is disabled — this lets us validate the refactor without latency/consistency variance.
11. Then enable read replication via dashboard or REST (`read_replication.mode: auto`) for `DB_VIDEOS` and `DB_CONTENT` only (one at a time to bisect any regression). `DB_AUTH` and `DB_FRONTEND_AUTH` stay on the primary.
12. Manual test: from a region far from the primary, hit a read-heavy endpoint (e.g. `mux.listVideosFromDatabase`), confirm `served_by_primary: false`. Then perform a write, immediately read, confirm consistency (read-my-own-writes via bookmark).

## Relevant files
- `worker/trpc/context.ts` — add `db: { videos, content }` and `rawSessions` to `Context`.
- `worker/api/entry.ts` — build sessions per request, write bookmark header on response.
- `worker/lib/d1-session.ts` *(new)* — session factory + bookmark codec.
- `worker/trpc/routers/mux/shared.ts` — `getVideosDb`, current single source of truth for DB_VIDEOS; switch to `ctx.db.videos`.
- `worker/trpc/routers/{blog,pages,documents}/index.ts` — DB_CONTENT helpers.
- `worker/trpc/routers/cf-images/helpers.ts`, `worker/api/cf-images/download.ts` — DB_CONTENT usage.
- `worker/api/webhooks/mux.ts` — uses `withSession("first-primary")` against DB_VIDEOS, no bookmark plumbing.
- *(frontend repo, out of workspace)* — service-binding caller needs to pass-through `x-d1-bookmarks`.
- **Untouched:** `src/lib/auth-server.ts`, `worker/trpc/routers/frontend-auth/index.ts`, anything reading `DB_AUTH` or `DB_FRONTEND_AUTH`.

## Verification
1. `pnpm tsc --noEmit` to ensure context type changes compile across all routers.
2. `pnpm wrangler dev --remote` and curl a read endpoint twice; second request should include `x-d1-bookmarks` reflecting the latest bookmark.
3. After deploy, query a read endpoint from a region far from the primary; in response logs check `served_by_primary === false`.
4. Write→read consistency test: POST a mutation, immediately GET the same record on a fresh request that forwards the bookmark; confirm the new value appears even when served by replica.
5. Watch D1 metrics in dashboard for per-region request distribution.

## Decisions
- **Scope limited to `DB_VIDEOS` + `DB_CONTENT`.** `DB_AUTH` and `DB_FRONTEND_AUTH` are managed by Better Auth and intentionally untouched. They keep hitting the primary; no Sessions API plumbing for them.
- **Single `x-d1-bookmarks` header (JSON `{ videos, content }`)** rather than one per binding. Simpler to forward through the service binding; payload is small.
- **Use `"first-unconstrained"` as the default** for cold sessions (no incoming bookmark). This is the right tradeoff for a CMS where most reads don't need the absolute latest data.
- **Webhooks always use `"first-primary"`** since they perform writes and have no upstream client to carry a bookmark.
- **Excluded from scope:** Better Auth refactor, cache middleware behavior changes, drizzle schema changes, and editing the frontend worker code (called out as a follow-up since it lives in a separate repo).

## Further considerations
1. **Where to store the bookmark on the browser side?** Option A: HttpOnly cookie set by the frontend worker (recommended — automatic, survives refresh). Option B: in-memory only on the React app and sent as a header (loses on reload). Option C: localStorage (fragile w/ multiple tabs). Recommend A.
2. **Should writes always force `first-primary`?** Drizzle mutations issued on a `first-unconstrained` session still get routed to primary (D1 always sends writes to primary), and the returned bookmark advances accordingly. So no — keep `first-unconstrained` as default; the session bookmark mechanism handles it.