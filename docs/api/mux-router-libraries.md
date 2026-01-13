# Mux Router - Library Management

Library procedures for managing Mux video libraries.

---

## `mux.listLibraries`

List all active Mux libraries.

**Type**: `query`  
**Auth**: Protected (session or API key)  
**Input**: None

**Output**:
```typescript
Array<{
  id: string;
  name: string;
  description: string | null;
  defaultPlaybackPolicy: 'public' | 'signed';
  defaultVideoQuality: 'basic' | 'plus' | 'premium';
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}>
```

**Example**:
```typescript
const libraries = await trpc.mux.listLibraries.query();
console.log(`Found ${libraries.length} libraries`);
```

---

## `mux.getLibrary`

Get a specific library by ID or the default library.

**Type**: `query`  
**Auth**: Protected  
**Input**:
```typescript
{ libraryId?: string }
```

**Output**:
```typescript
{
  id: string;
  name: string;
  description: string | null;
  muxEnvironmentId: string | null;
  tokenId: string;
  signingKeyId: string | null;
  webhookSecret: string | null;
  defaultPlaybackPolicy: 'public' | 'signed';
  defaultVideoQuality: 'basic' | 'plus' | 'premium';
  isDefault: boolean;
  isActive: boolean;
  hasSigningKey: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**Example**:
```typescript
// Get default library
const library = await trpc.mux.getLibrary.query({});

// Get specific library
const library = await trpc.mux.getLibrary.query({ 
  libraryId: 'lib_123' 
});
```

---

## `mux.createLibrary`

Create a new Mux library.

**Type**: `mutation`  
**Auth**: Protected  
**Input**:
```typescript
{
  name: string;                                      // 1-100 chars
  description?: string;                              // max 500 chars
  muxEnvironmentId?: string;
  tokenId: string;                                   // Mux API token ID
  tokenSecret: string;                               // Mux API token secret
  signingKeyId?: string;                             // For signed playback
  signingKeyPrivate?: string;                        // Private key for signing
  webhookSecret?: string;                            // Webhook signature verification
  defaultPlaybackPolicy?: 'public' | 'signed';       // Default: 'public'
  defaultVideoQuality?: 'basic' | 'plus' | 'premium'; // Default: 'plus'
  isDefault?: boolean;                               // Default: false
}
```

**Example**:
```typescript
const library = await trpc.mux.createLibrary.mutate({
  name: 'Production Videos',
  description: 'Main video library for production content',
  tokenId: 'your-mux-token-id',
  tokenSecret: 'your-mux-token-secret',
  defaultPlaybackPolicy: 'public',
  defaultVideoQuality: 'plus',
  isDefault: true,
});
```

---

## `mux.updateLibrary`

Update an existing library.

**Type**: `mutation`  
**Auth**: Protected  
**Input**:
```typescript
{
  libraryId: string;
  name?: string;
  description?: string | null;
  muxEnvironmentId?: string | null;
  tokenId?: string;
  tokenSecret?: string;
  signingKeyId?: string | null;
  signingKeyPrivate?: string | null;
  webhookSecret?: string | null;
  defaultPlaybackPolicy?: 'public' | 'signed';
  defaultVideoQuality?: 'basic' | 'plus' | 'premium';
  isDefault?: boolean;
}
```

**Example**:
```typescript
await trpc.mux.updateLibrary.mutate({
  libraryId: 'lib_123',
  name: 'Updated Library Name',
  defaultVideoQuality: 'premium',
});
```

---

## `mux.deleteLibrary`

Delete a library.

**Type**: `mutation`  
**Auth**: Protected  
**Input**: `{ libraryId: string }`  
**Output**: `{ success: boolean }`

**Example**:
```typescript
await trpc.mux.deleteLibrary.mutate({ 
  libraryId: 'lib_123' 
});
```

---

## `mux.testLibraryCredentials`

Test Mux API credentials before saving.

**Type**: `mutation`  
**Auth**: Protected  
**Input**:
```typescript
{
  tokenId: string;
  tokenSecret: string;
}
```

**Output**:
```typescript
{
  success: boolean;
  message: string;
}
```

**Example**:
```typescript
const result = await trpc.mux.testLibraryCredentials.mutate({
  tokenId: 'your-token-id',
  tokenSecret: 'your-token-secret',
});

if (result.success) {
  console.log('Credentials are valid!');
} else {
  console.error('Invalid credentials:', result.message);
}
```

---

## Related Documentation

- [Mux Router Overview](./mux-router.md) - All Mux procedures
- [Authentication](./authentication.md) - API authentication
- [Types](./types.md) - Library type definition
