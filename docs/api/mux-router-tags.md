# Mux Router - Tag Management

Video tag management procedures for creating, updating, assigning, and searching videos by tags.

---

## Overview

Tags are global, reusable labels that help organize and categorize videos across your library. The tag system uses a many-to-many relationship where:

- **VideoTag**: Defines the tag itself (global registry)
- **VideoTagAssignment**: Maps tags to specific videos (many-to-many junction)

Tags support:
- Case-insensitive slugs for unique identification
- Soft deletion (marking as inactive)
- Full-text search by tag name
- Video search by single or multiple tags
- Tag statistics and usage analytics

---

## Tag Management

### `listTags`

List all active tags.

**Type**: `query`  
**Input**: `{}`  
**Output**: `Array<VideoTag>`

Returns all tags marked as active, ordered by name.

**Example**:
```typescript
const tags = await trpc.mux.listTags.query({});
// Returns: [{ id: 'tag_...', slug: 'tutorial', name: 'Tutorial', description: '...', isActive: true }, ...]
```

---

### `createTag`

Create a new tag.

**Type**: `mutation`  
**Input**:
```typescript
{
  name: string;              // 1-50 characters
  description?: string;      // 0-200 characters (optional)
}
```

**Output**: `VideoTag`

Creates a new global tag. Slug is generated automatically from the name. If a tag with the same slug already exists, returns a CONFLICT error.

**Example**:
```typescript
const newTag = await trpc.mux.createTag.mutate({
  name: 'Behind the Scenes',
  description: 'Behind-the-scenes footage and production content',
});
```

---

### `updateTag`

Update an existing tag.

**Type**: `mutation`  
**Input**:
```typescript
{
  tagId: string;                  // Tag to update
  name?: string;                  // 1-50 characters
  description?: string | null;    // 0-200 characters or null to clear
  isActive?: boolean;             // Activate/deactivate tag
}
```

**Output**: `VideoTag`

Updates tag metadata. If the name changes, the slug is regenerated. Only active tags can be assigned to new videos.

**Example**:
```typescript
const updated = await trpc.mux.updateTag.mutate({
  tagId: 'tag_abc123',
  name: 'Behind the Scenes',
  isActive: true,
});
```

---

### `deleteTag`

Soft-delete a tag (mark as inactive).

**Type**: `mutation`  
**Input**: `{ tagId: string }`  
**Output**: `{ success: boolean }`

Marks a tag as inactive without removing it from the database. Inactive tags cannot be assigned to new videos but remain associated with existing videos.

**Example**:
```typescript
await trpc.mux.deleteTag.mutate({ tagId: 'tag_abc123' });
```

---

### `getTagStatistics`

Get tag usage statistics.

**Type**: `query`  
**Input**:
```typescript
{
  libraryId?: string;  // Filter by library (optional)
}
```

**Output**:
```typescript
Array<{
  tagId: string;
  tagSlug: string;
  tagName: string;
  videoCount: number;  // Number of videos with this tag
}>
```

Returns statistics for all active tags, sorted by usage count (highest first). Optionally filter to a specific library.

**Example**:
```typescript
const stats = await trpc.mux.getTagStatistics.query({ libraryId: 'lib_123' });
// Returns: [{ tagId: '...', tagSlug: 'tutorial', tagName: 'Tutorial', videoCount: 42 }, ...]
```

---

## Video-Tag Assignment

### `setVideoTags`

Assign tags to a video (replace all existing tags).

**Type**: `mutation`  
**Input**:
```typescript
{
  videoId: string;      // Internal database video ID
  libraryId: string;    // Video's library
  tagIds: string[];     // Array of tag IDs (max 20)
}
```

**Output**: `Array<VideoTagDetail>`

```typescript
{
  id: string;           // Tag ID
  slug: string;         // Tag slug
  name: string;         // Tag name
  description?: string; // Tag description
}
```

Replaces all tags for a video. Pass an empty array to remove all tags. All tags must exist and be active.

**Example**:
```typescript
const updatedTags = await trpc.mux.setVideoTags.mutate({
  videoId: 'vid_abc123',
  libraryId: 'lib_456',
  tagIds: ['tag_tutorial', 'tag_behind-scenes'],
});
```

---

### `getVideoTags`

Get tags assigned to a video.

**Type**: `query`  
**Input**:
```typescript
{
  videoId: string;      // Internal database video ID
  libraryId: string;    // Video's library
}
```

**Output**: `Array<VideoTagDetail>`

Returns all active tags assigned to a specific video, ordered by name.

**Example**:
```typescript
const tags = await trpc.mux.getVideoTags.query({
  videoId: 'vid_abc123',
  libraryId: 'lib_456',
});
// Returns: [{ id: 'tag_...', slug: 'tutorial', name: 'Tutorial', ... }, ...]
```

---

## Search Operations

### `searchVideosByTags`

Search for videos by one or more tags.

**Type**: `query`  
**Input**:
```typescript
{
  libraryId: string;           // Videos must be in this library
  tagIds: string[];            // At least one tag ID required
  matchMode: 'any' | 'all';    // 'any' = OR, 'all' = AND (default: 'any')
  limit?: number;              // 1-100 (default: 50)
  offset?: number;             // Pagination offset (default: 0)
}
```

**Output**:
```typescript
Array<{
  id: string;
  title: string;
  description?: string;
  muxPlaybackId: string | null;
  playbackPolicy: 'public' | 'signed';
  duration: number;
  createdAt: string;
  tagCount?: number;  // Only in 'all' mode - count of matching tags
}>
```

**Match Modes**:
- `any` (OR): Returns videos with **at least one** of the specified tags
- `all` (AND): Returns videos with **all** of the specified tags (slower, more specific)

**Example - Find videos with Tutorial OR Behind-Scenes tags**:
```typescript
const videos = await trpc.mux.searchVideosByTags.query({
  libraryId: 'lib_456',
  tagIds: ['tag_tutorial', 'tag_behind-scenes'],
  matchMode: 'any',
  limit: 20,
  offset: 0,
});
```

**Example - Find videos with BOTH Tutorial AND Interview tags**:
```typescript
const videos = await trpc.mux.searchVideosByTags.query({
  libraryId: 'lib_456',
  tagIds: ['tag_tutorial', 'tag_interview'],
  matchMode: 'all',
  limit: 20,
});
```

---

## Type Definitions

### `VideoTag`

```typescript
interface VideoTag {
  id: string;               // Unique tag identifier
  slug: string;             // URL-friendly unique slug
  name: string;             // Human-readable tag name
  description?: string;     // Optional description
  isActive: boolean;        // Whether tag can be assigned
  createdAt: number;        // Timestamp in milliseconds
}
```

### `VideoTagAssignment`

```typescript
interface VideoTagAssignment {
  id: string;               // Unique assignment identifier
  videoId: string;          // Assigned video ID
  tagId: string;            // Assigned tag ID
  assignedAt: number;       // Timestamp in milliseconds
}
```

---

## Common Patterns

### Bulk Tag Update

```typescript
// 1. Fetch current tags for comparison
const currentTags = await trpc.mux.getVideoTags.query({
  videoId: 'vid_abc123',
  libraryId: 'lib_456',
});

// 2. Update tags (replaces all)
const updated = await trpc.mux.setVideoTags.mutate({
  videoId: 'vid_abc123',
  libraryId: 'lib_456',
  tagIds: newTagIds,
});
```

### Filter Videos by Multiple Tags

```typescript
// Find videos tagged with BOTH 'interview' AND 'expert'
const interviews = await trpc.mux.searchVideosByTags.query({
  libraryId: 'lib_456',
  tagIds: ['tag_interview', 'tag_expert'],
  matchMode: 'all',
  limit: 50,
});
```

### Tag Cleanup (Archive Unused Tags)

```typescript
// Get statistics to find unused tags
const stats = await trpc.mux.getTagStatistics.query({
  libraryId: 'lib_456',
});

// Archive tags with zero usage
const unusedTags = stats.filter(s => s.videoCount === 0);
for (const tag of unusedTags) {
  await trpc.mux.updateTag.mutate({
    tagId: tag.tagId,
    isActive: false,
  });
}
```

---

## Error Handling

| Error Code | Scenario |
|------------|----------|
| `CONFLICT` | Tag with this name already exists |
| `NOT_FOUND` | Tag or video not found |
| `BAD_REQUEST` | Invalid input or one/more tags are inactive |
| `INTERNAL_SERVER_ERROR` | Database or server error |

---

## Best Practices

1. **Tag Naming**: Use descriptive, lowercase names (e.g., "behind-the-scenes" not "BTS")
2. **Reusable**: Create global tags that apply across libraries
3. **Limits**: Maximum 20 tags per video
4. **Soft Delete**: Deactivate rather than delete tags to preserve relationships
5. **Search**: Use `matchMode: 'all'` for precise filtering, `'any'` for broader results
6. **Statistics**: Monitor tag usage to identify organizational gaps

---

## Related Documentation

- [Video Management](./mux-router-videos.md) - Video CRUD operations
- [Mux Router Overview](./mux-router.md) - Complete router structure
- [Types](./types.md) - Type definitions
- [Usage Examples](./usage-examples.md) - Practical implementation examples
