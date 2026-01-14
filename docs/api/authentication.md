# Authentication

The API supports two authentication methods for different use cases.

---

## 1. Session Cookie Authentication (Browser)

For browser-based applications, authentication uses HTTP-only session cookies managed by Better Auth. When using Service Bindings, cookies must be forwarded from the original request:

```typescript
// In Astro server-side code
const { env } = Astro.locals.runtime;

// Forward the original request headers (includes cookies)
const response = await env.AWT_API.fetch(new Request('https://awt-backend-worker/trpc/...', {
  headers: Astro.request.headers, // Forwards cookies automatically
}));
```

For client-side React components, the API proxy route handles cookie forwarding:

```typescript
// Browser fetch - cookies sent automatically via credentials: 'include'
fetch('/api/trpc/mux.listLibraries', { credentials: 'include' })
```

---

## 2. API Key Authentication (Server-Side)

For server-to-server communication or when making authenticated calls without a user session, use API keys via the `x-api-key` header:

```typescript
// In Astro server-side code
const { env } = Astro.locals.runtime;

const response = await env.AWT_API.fetch(new Request('https://awt-backend-worker/trpc/...', {
  headers: {
    'x-api-key': 'awt_your_api_key_here'
  }
}));
```

**API Key Format**: All API keys are prefixed with `awt_` (e.g., `awt_abc123xyz...`)

---

## API Key Permissions

API keys can have granular permissions for different resources:

| Resource | Actions | Description |
|----------|---------|-------------|
| `mux` | `read`, `write`, `delete` | Video management |
| `playlists` | `read`, `write`, `delete` | Playlist management |
| `libraries` | `read`, `write` | Library configuration |

**Permission Structure**:
```typescript
type Permissions = {
  mux?: ('read' | 'write' | 'delete')[];
  playlists?: ('read' | 'write' | 'delete')[];
  libraries?: ('read' | 'write')[];
};
```

### Example: Creating an API Key with Permissions

```typescript
const apiKey = await trpc.apiKeys.create.mutate({
  name: 'Video Management Key',
  permissions: {
    mux: ['read', 'write'],
    playlists: ['read'],
  },
  expiresIn: 60 * 60 * 24 * 365, // 1 year
});

// Store the full key securely - it's only returned once!
console.log(apiKey.key); // awt_abc123...
```

---

## Authentication Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/auth/sign-in` | Sign in with credentials |
| `/api/auth/sign-up` | Register new account |
| `/api/auth/sign-out` | Sign out current session |
| `/api/auth/session` | Get current session |

For detailed API key management, see the [API Keys Router](./api-keys-router.md) documentation.

---

## Related Documentation

- [API Keys Router](./api-keys-router.md) - Managing API keys
- [tRPC Client Setup](./trpc-setup.md) - Configuring auth in tRPC clients
- [Best Practices](./best-practices.md) - Security recommendations
