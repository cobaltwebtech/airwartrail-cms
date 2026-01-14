# Architecture Overview

This document describes the technical architecture of the AirWarTrail Dashboard.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Cloudflare Workers |
| API Framework | Hono |
| RPC Layer | tRPC with SuperJSON transformer |
| Authentication | Better Auth with API Key plugin |
| Database | Cloudflare D1 (SQLite) with Drizzle ORM |
| Video Service | Mux |
| Frontend | Astro + React with Cloudflare Adapter |
| Communication | Cloudflare Service Bindings (Worker-to-Worker) |

---

## Service Bindings Architecture

The frontend Astro/React app communicates with the backend API via **Cloudflare Service Bindings** instead of HTTP requests. This provides:

- **Zero latency overhead** - Both Workers run on the same thread of the same Cloudflare server
- **Enhanced security** - The API Worker can be isolated from the public Internet
- **No additional costs** - Service bindings are free
- **Smart Placement compatible** - Each Worker can run in the optimal location

```
┌─────────────────────┐    Service Binding    ┌─────────────────────┐
│   Astro Frontend    │ ─────────────────────▶│  AirWarTrail API    │
│   (Public Worker)   │  env.AWT_API.fetch()  │  (Internal Worker)  │
└─────────────────────┘                       └─────────────────────┘
         │                                               │
         ▼                                               ▼
    Public Internet                              D1 Database, Mux
```

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/auth/*` | Better Auth authentication routes |
| `/trpc/*` | tRPC API endpoints |
| `/api/webhooks/mux` | Mux webhook handler |

---

## Service Binding Configuration

### Wrangler Configuration (Frontend Worker)

Configure the Service Binding in your Astro frontend's `wrangler.jsonc`:

```jsonc
// wrangler.jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "airwartrail-frontend",
  "compatibility_date": "2025-12-15",
	"compatibility_flags": [
		"nodejs_compat"
	],
  "services": [
    {
      "binding": "AWT_API",
      "service": "airwartrail-dashboard"
    }
  ]
}
```

### TypeScript Environment Types

Create type definitions for the Cloudflare environment:

```typescript
// src/env.d.ts
/// <reference types="astro/client" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

interface Env {
  API: Fetcher; // Service binding to the API Worker
}

declare namespace App {
  interface Locals extends Runtime {}
}
```

### Accessing the Service Binding in Astro

In Astro pages and API routes, access the Service Binding via `Astro.locals.runtime`:

```typescript
// In an Astro page (.astro file)
---
const { env } = Astro.locals.runtime;

// Call the API Worker directly via Service Binding
const response = await env.AWT_API.fetch(new Request('https://awt-api-worker/trpc/mux.listLibraries', {
  method: 'GET',
  headers: Astro.request.headers, // Forward auth cookies
}));
---
```

---

## Service Binding Limits

- Each request via Service Binding counts toward your subrequest limit
- Maximum 32 Worker invocations per single request
- Service bindings don't count toward simultaneous open connection limits

---

## Local Development

Run both Workers with `wrangler dev`. The Service Binding will show as `connected` when both are running:

```bash
# Terminal 1: API Worker
cd airwartrail-dashboard && wrangler dev

# Terminal 2: Frontend Worker  
cd airwartrail-frontend && wrangler dev
```

Or use the multi-config approach:

```bash
wrangler dev -c wrangler.json -c ../airwartrail-dashboard/wrangler.jsonc
```

---

## Related Documentation

- [Authentication](./authentication.md) - Auth methods and setup
- [tRPC Client Setup](./trpc-setup.md) - Configure your tRPC client
- [Best Practices](./best-practices.md) - Service Binding best practices
