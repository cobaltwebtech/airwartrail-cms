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
}

export type StatusMap = Record<VideoStatus, string>;