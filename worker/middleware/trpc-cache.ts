import type { Context, Next } from "hono";

/**
 * tRPC procedures safe to cache at the edge.
 *
 * Only include GET-based procedures returning data that is:
 *  - Not user-specific
 *  - Acceptable to be stale for the TTL duration
 *
 * Values are TTL in seconds. When a batched request includes multiple
 * procedures, the effective TTL is the minimum of the matched values.
 */
const CACHEABLE_PROCEDURES: Record<string, number> = {
	"mux.getVideoById": 60,
	"mux.getThumbnail": 300,
	"mux.getPlaylist": 60,
	"mux.listVideosFromDatabase": 30,
	"mux.listTags": 300,
};

const CACHE_HEADER = "X-Cache";

/**
 * Edge cache for cacheable tRPC GET procedures.
 *
 * MUST be registered AFTER the auth middleware so unauthenticated requests
 * return 401 before reaching the cache. The cache key is the bare URL with
 * no headers — auth tokens (cookie, x-api-key) are intentionally excluded.
 *
 * Handles tRPC's batched URL format: `/trpc/proc1,proc2,proc3?batch=1&...`.
 * A batch is only cached if every procedure in it is in the allow-list.
 */
export async function trpcCacheMiddleware(
	c: Context<{ Bindings: Env }>,
	next: Next,
) {
	if (c.req.method !== "GET") {
		return next();
	}

	const url = new URL(c.req.url);

	// e.g. "/trpc/mux.getThumbnail,mux.getThumbnail" -> ["mux.getThumbnail", "mux.getThumbnail"]
	const pathPart = url.pathname.replace(/^\/trpc\//, "");
	const procedures = pathPart.split(",").filter(Boolean);

	if (procedures.length === 0) {
		return next();
	}

	// Every procedure in the batch must be cacheable
	const ttls: number[] = [];
	for (const proc of procedures) {
		const ttl = CACHEABLE_PROCEDURES[proc];
		if (ttl === undefined) {
			return next();
		}
		ttls.push(ttl);
	}
	const ttl = Math.min(...ttls);

	// `caches.default` is Cloudflare Workers-specific and not in the DOM lib types.
	const cache = (caches as unknown as { default: Cache }).default;

	// Build a cache key from the URL only — never include auth headers.
	// Auth was already enforced upstream so unauth requests cannot reach this layer.
	const cacheKey = new Request(url.toString(), { method: "GET" });

	const cached = await cache.match(cacheKey);
	if (cached) {
		const hit = new Response(cached.body, cached);
		hit.headers.set(CACHE_HEADER, "HIT");
		return hit;
	}

	await next();

	const res = c.res;
	if (!res || !res.ok) {
		return;
	}

	const headers = new Headers(res.headers);
	headers.set(
		"Cache-Control",
		`public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`,
	);
	headers.set(CACHE_HEADER, "MISS");

	const toCache = new Response(res.clone().body, {
		status: res.status,
		headers,
	});

	c.executionCtx.waitUntil(cache.put(cacheKey, toCache));

	// Reflect the diagnostic header on the live response too
	c.res.headers.set(CACHE_HEADER, "MISS");
}
