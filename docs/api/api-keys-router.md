# API Keys Router

The `apiKeys` router handles API key management for the current user.

---

## `apiKeys.list`

List all API keys for the current user.

**Type**: `query`  
**Auth**: Protected (session only, not API key)

**Output**:
```typescript
Array<{
  id: string;
  name: string;
  start: string;                // First few chars for identification
  prefix: string;               // 'awt_'
  enabled: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastRequest: Date | null;
  requestCount: number;
  rateLimitEnabled: boolean;
  rateLimitMax: number | null;
  rateLimitTimeWindow: number | null;
  permissions: Record<string, string[]> | null;
  metadata: Record<string, unknown> | null;
}>
```

---

## `apiKeys.get`

Get a specific API key by ID.

**Type**: `query`  
**Auth**: Protected  
**Input**: `{ keyId: string }`

**Output**: Detailed API key object (includes rate limit info)

---

## `apiKeys.create`

Create a new API key.

**Type**: `mutation`  
**Auth**: Protected  
**Input**:
```typescript
{
  name: string;                                    // 1-100 chars
  expiresIn?: number;                              // Seconds until expiration
  permissions?: Record<string, string[]>;          // e.g., { mux: ['read', 'write'] }
  metadata?: Record<string, unknown>;
}
```

**Output**:
```typescript
{
  id: string;
  name: string;
  key: string;      // FULL KEY - Only returned on creation!
  start: string;
  prefix: string;
  enabled: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  permissions: Record<string, string[]> | null;
  metadata: Record<string, unknown> | null;
}
```

> ⚠️ **Important**: The full `key` value is only returned once during creation. Store it securely!

---

## `apiKeys.update`

Update an existing API key.

**Type**: `mutation`  
**Auth**: Protected  
**Input**:
```typescript
{
  keyId: string;
  name?: string;
  enabled?: boolean;
  permissions?: Record<string, string[]>;
  metadata?: Record<string, unknown>;
}
```

**Output**: Updated API key object (without the key value)

---

## `apiKeys.delete`

Delete an API key.

**Type**: `mutation`  
**Auth**: Protected  
**Input**: `{ keyId: string }`  
**Output**: `{ success: boolean }`

---

## `apiKeys.getPermissionOptions`

Get available permission options for API keys.

**Type**: `query`  
**Auth**: Protected

**Output**:
```typescript
{
  resources: {
    mux: {
      label: 'Mux Videos';
      description: 'Access to video management API';
      actions: [
        { id: 'read', label: 'Read', description: 'View videos and metadata' },
        { id: 'write', label: 'Write', description: 'Create and update videos' },
        { id: 'delete', label: 'Delete', description: 'Delete videos' }
      ];
    };
    playlists: { /* similar structure */ };
    libraries: { /* similar structure */ };
  };
}
```

---

## Usage Examples

### Create an API Key

```typescript
const apiKey = await trpc.apiKeys.create.mutate({
  name: 'Production API Key',
  permissions: {
    mux: ['read', 'write'],
    playlists: ['read'],
  },
  expiresIn: 60 * 60 * 24 * 365, // 1 year
});

// ⚠️ Store this securely - you won't see it again!
console.log('API Key:', apiKey.key);
```

### List User's API Keys

```typescript
const keys = await trpc.apiKeys.list.query();

keys.forEach(key => {
  console.log(`${key.name} (${key.start}***)`);
  console.log(`Requests: ${key.requestCount}`);
  console.log(`Expires: ${key.expiresAt}`);
});
```

### Update API Key Permissions

```typescript
await trpc.apiKeys.update.mutate({
  keyId: 'key_123',
  permissions: {
    mux: ['read'], // Downgrade to read-only
  },
});
```

### Disable an API Key

```typescript
await trpc.apiKeys.update.mutate({
  keyId: 'key_123',
  enabled: false,
});
```

### Delete an API Key

```typescript
await trpc.apiKeys.delete.mutate({
  keyId: 'key_123',
});
```

---

## Related Documentation

- [Authentication](./authentication.md) - Using API keys for authentication
- [Error Handling](./error-handling.md) - Handling API key errors
