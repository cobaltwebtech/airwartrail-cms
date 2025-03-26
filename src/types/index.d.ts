//Custom type declarations go here

export type VideoStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface Video {
  id: string;
  guid?: string;
  title: string;
  thumbnail?: string;
  thumbnailFileName?: string;
  collectionId?: string;
  duration: number;
  status: VideoStatus;
  statusText: string;
  createdAt: string;
  dateUploaded?: string;
  captions?: { label: string; srclang: string }[];
  chapters?: { title: string; start: number; end: number }[];
  moments?: { label: string; timestamp: number }[];
}

export type StatusMap = Record<VideoStatus, string>;

export interface Collection {
  videoLibraryId: number;
  guid: string;
  name: string;
  videoCount: number;
  totalSize: number;
  previewVideoIds: string;
  previewImageUrls: string[];
}
