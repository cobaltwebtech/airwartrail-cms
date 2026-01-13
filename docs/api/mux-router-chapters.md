# Mux Router - Chapter Management

Video chapter management procedures.

## `mux.getChapters`

Get chapters for a video.

**Input**: `{ videoId: string; libraryId?: string }`  
**Returns**: Array of chapters with title, startTime, endTime, sortOrder

## `mux.saveChapters`

Save/replace all chapters for a video.

**Input**:
```typescript
{
  videoId: string;
  libraryId?: string;
  chapters: Array<{
    id?: string;
    title: string;
    startTime: number;  // Seconds
    endTime?: number | null;
    sortOrder?: number;
    thumbnailTime?: number | null;
  }>;
}
```

## `mux.deleteChapter`

Delete a single chapter.

**Input**: `{ chapterId: string }`  
**Returns**: `{ success: boolean }`

Refer to original documentation for complete schemas.
