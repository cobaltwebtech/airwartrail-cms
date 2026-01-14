# AirWarTrail Dashboard API Documentation

> **For Claude Agent Context**: This is the main index for the AirWarTrail Dashboard API documentation. The backend is built with **tRPC**, **Hono**, and **Better Auth** running on **Cloudflare Workers**. Navigate to specific sections below for detailed information.

---

## Quick Links

- **[Architecture Overview](./architecture.md)** - Tech stack, service bindings, and system design
- **[Authentication](./authentication.md)** - Session cookies and API key authentication
- **[tRPC Client Setup](./trpc-setup.md)** - Configure tRPC with Service Bindings for Astro + React
- **[Mux Router API](./mux-router.md)** - Complete video and playlist management API
- **[API Keys Router](./api-keys-router.md)** - API key management endpoints
- **[Type Definitions](./types.md)** - TypeScript interfaces and types
- **[Error Handling](./error-handling.md)** - Error codes and handling strategies
- **[Usage Examples](./usage-examples.md)** - Practical implementation examples
- **[Video Player Integration](./video-player.md)** - Mux Player setup and configuration
- **[Best Practices](./best-practices.md)** - Implementation guidelines and tips

---

## Getting Started

1. **Understand the architecture** - Start with [Architecture Overview](./architecture.md) to understand Service Bindings
2. **Set up authentication** - Review [Authentication](./authentication.md) for session and API key auth
3. **Configure tRPC** - Follow [tRPC Client Setup](./trpc-setup.md) to set up your client
4. **Explore the API** - Browse [Mux Router API](./mux-router.md) and [API Keys Router](./api-keys-router.md)
5. **Implement features** - Use [Usage Examples](./usage-examples.md) as reference

---

## API Endpoints

| Endpoint | Purpose | Documentation |
|----------|---------|---------------|
| `/api/auth/*` | Better Auth authentication | [Authentication](./authentication.md) |
| `/trpc/*` | tRPC API endpoints | [Mux Router](./mux-router.md), [API Keys Router](./api-keys-router.md) |
| `/api/webhooks/mux` | Mux webhook handler | [Architecture](./architecture.md) |

---

## Base URL

```
Production: https://www.airwartrail.com
Development: http://localhost:4321
```

> **Note**: When using Service Bindings, you don't need the base URL - you call the API directly via `env.AWT_API.fetch()`.

---

## Support

For questions or issues:
- Review the [Best Practices](./best-practices.md) guide
- Check [Error Handling](./error-handling.md) for common issues
- Refer to [Usage Examples](./usage-examples.md) for implementation patterns
