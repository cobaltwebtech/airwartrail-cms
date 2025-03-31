//Custom type declarations go here
import type { $Infer } from "./auth-client";

export type ActiveSession = typeof $Infer.Session;

declare namespace App {
  export interface Locals {
    user: import("better-auth").User | null;
    session: import("better-auth").Session | null;
  }
}

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
  views: number;
  storageSize: number;
  statusText: string;
  dateUploaded: string;
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
