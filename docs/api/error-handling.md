# Error Handling

This document describes error codes, formats, and handling strategies.

---

## tRPC Error Codes

The API uses standard tRPC error codes:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Authentication required or invalid |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `BAD_REQUEST` | 400 | Invalid input |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

---

## Error Response Format

```typescript
{
  error: {
    code: string;
    message: string;
    data?: unknown;
  }
}
```

---

## Client-Side Error Handling

### Basic Try-Catch

```typescript
import { TRPCClientError } from '@trpc/client';

try {
  await trpc.mux.getVideoById.query({ videoId: 'xxx', libraryId: 'yyy' });
} catch (error) {
  if (error instanceof TRPCClientError) {
    console.error('Error code:', error.data?.code);
    console.error('Message:', error.message);
  }
}
```

### With TanStack Query

```typescript
import { useQuery } from '@tanstack/react-query';
import { trpc } from '../lib/trpc-client';

function VideoComponent({ videoId, libraryId }: Props) {
  const { data, error, isError } = useQuery(
    trpc.mux.getVideoById.queryOptions({ videoId, libraryId })
  );

  if (isError) {
    // Handle specific error codes
    if (error.data?.code === 'NOT_FOUND') {
      return <div>Video not found</div>;
    }
    if (error.data?.code === 'UNAUTHORIZED') {
      return <div>Please log in to view this video</div>;
    }
    return <div>Error: {error.message}</div>;
  }

  return <div>{data?.title}</div>;
}
```

---

## Common Error Scenarios

### Authentication Errors

```typescript
// UNAUTHORIZED - No session or invalid API key
{
  code: 'UNAUTHORIZED',
  message: 'You must be logged in to access this resource'
}

// FORBIDDEN - Valid auth but insufficient permissions
{
  code: 'FORBIDDEN',
  message: 'You do not have permission to delete videos'
}
```

**Solution**: Check authentication status or API key permissions.

---

### Resource Not Found

```typescript
{
  code: 'NOT_FOUND',
  message: 'Video with ID "xxx" not found'
}
```

**Solution**: Verify the resource ID exists and is accessible.

---

### Validation Errors

```typescript
{
  code: 'BAD_REQUEST',
  message: 'Invalid input',
  data: {
    zodError: {
      fieldErrors: {
        title: ['Title must be at least 1 character'],
        tags: ['Maximum 12 tags allowed']
      }
    }
  }
}
```

**Solution**: Check input against the schema requirements.

---

### Rate Limiting

```typescript
{
  code: 'TOO_MANY_REQUESTS',
  message: 'Rate limit exceeded. Try again in 3600 seconds.',
  data: {
    retryAfter: 3600
  }
}
```

**Solution**: Wait for the specified time or upgrade rate limits.

---

### Conflict Errors

```typescript
{
  code: 'CONFLICT',
  message: 'A playlist with slug "my-playlist" already exists'
}
```

**Solution**: Use a different slug or update the existing resource.

---

## Error Handling Utilities

### Create a Reusable Error Handler

```typescript
// src/lib/error-handler.ts
import { TRPCClientError } from '@trpc/client';
import { toast } from 'sonner';

export function handleTRPCError(error: unknown) {
  if (error instanceof TRPCClientError) {
    const code = error.data?.code;
    
    switch (code) {
      case 'UNAUTHORIZED':
        toast.error('Please log in to continue');
        // Redirect to login
        window.location.href = '/auth/sign-in';
        break;
        
      case 'FORBIDDEN':
        toast.error('You do not have permission for this action');
        break;
        
      case 'NOT_FOUND':
        toast.error('Resource not found');
        break;
        
      case 'CONFLICT':
        toast.error(error.message);
        break;
        
      default:
        toast.error('An error occurred. Please try again.');
    }
    
    return;
  }
  
  // Non-tRPC error
  toast.error('An unexpected error occurred');
  console.error(error);
}
```

### Usage in Components

```typescript
import { useMutation } from '@tanstack/react-query';
import { trpc } from '../lib/trpc-client';
import { handleTRPCError } from '../lib/error-handler';

function DeleteVideoButton({ videoId, libraryId }: Props) {
  const mutation = useMutation({
    mutationFn: () => trpc.mux.deleteVideoById.mutate({ videoId, libraryId }),
    onError: handleTRPCError,
    onSuccess: () => {
      toast.success('Video deleted');
    },
  });

  return (
    <button onClick={() => mutation.mutate()}>
      Delete Video
    </button>
  );
}
```

---

## Retry Strategies

### Automatic Retries with TanStack Query

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on auth or validation errors
        if (error instanceof TRPCClientError) {
          const code = error.data?.code;
          if (['UNAUTHORIZED', 'FORBIDDEN', 'BAD_REQUEST'].includes(code)) {
            return false;
          }
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});
```

---

## Related Documentation

- [tRPC Client Setup](./trpc-setup.md) - Configuring error handling
- [Usage Examples](./usage-examples.md) - Error handling in context
