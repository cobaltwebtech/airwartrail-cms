// This file contains functions to interact with the Bunny.net Stream API
import type { Video, StatusMap, VideoStatus } from "@/types";

// For server-side API calls
const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;
const bunnyCdn = import.meta.env.PUBLIC_BUNNY_STREAM_CDN;
const apiKey = import.meta.env.BUNNY_API_KEY;

// Bunny Stream video status numbers referenced to text values
const statusMap: StatusMap = {
  0: "Created",
  1: "Uploaded",
  2: "Processing",
  3: "Transcoding",
  4: "Finished",
  5: "Error",
  6: "UploadFailed",
  7: "JitSegmenting",
  8: "JitPlaylistsCreated",
};

// Helper function to generate thumbnail URL
function getThumbnailUrl(video: {
  guid?: string;
  thumbnailFileName?: string;
}): string {
  if (video.thumbnailFileName && video.guid) {
    return `https://${bunnyCdn}/${video.guid}/${video.thumbnailFileName}`;
  }
  return "/placeholder.svg?height=720&width=1280";
}

interface BunnyApiResponseItem {
  guid?: string;
  id: string;
  title: string;
  length?: number;
  status: number;
  dateUploaded?: string;
  collectionId?: string;
  captions?: { label: string; srclang: string }[];
  chapters?: { title: string; start: number; end: number }[];
  moments?: { label: string; timestamp: number }[];
}

interface BunnyApiResponse {
  items?: BunnyApiResponseItem[];
  videos?: BunnyApiResponseItem[];
}

export async function getVideos(): Promise<Video[]> {
  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos`,
      {
        headers: {
          AccessKey: apiKey,
          "Content-Type": "application/json",
        },
      },
    );

    const data: BunnyApiResponse = await response.json();

    const mapVideoResponse = (video: BunnyApiResponseItem) => ({
      id: video.guid || video.id,
      guid: video.guid,
      title: video.title,
      thumbnail: getThumbnailUrl(video),
      duration: video.length || 0,
      status: video.status as VideoStatus,
      statusText: statusMap[video.status as VideoStatus] || "Unknown",
      createdAt: video.dateUploaded || new Date().toISOString(),
      collectionId: video.collectionId || "",
      captions: video.captions || [],
      chapters: video.chapters || [],
    });

    if (Array.isArray(data)) {
      return data.map(mapVideoResponse);
    } else if (data.items && Array.isArray(data.items)) {
      return data.items.map(mapVideoResponse);
    } else if (data.videos && Array.isArray(data.videos)) {
      return data.videos.map(mapVideoResponse);
    }

    console.error("Unexpected API response structure:", data);
    return [];
  } catch (error) {
    console.error("Error fetching videos:", error);
    return [];
  }
}

export async function getVideo(videoId: string): Promise<Video | null> {
  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
      {
        headers: {
          AccessKey: apiKey,
          "Content-Type": "application/json",
        },
      },
    );

    const video: BunnyApiResponseItem = await response.json();
    console.log("Bunny Stream video data:", JSON.stringify(video, null, 2));

    return {
      id: video.guid || video.id,
      guid: video.guid,
      title: video.title,
      thumbnail: getThumbnailUrl(video),
      duration: video.length || 0,
      status: video.status as VideoStatus,
      statusText: statusMap[video.status as VideoStatus] || "Unknown",
      createdAt: video.dateUploaded || new Date().toISOString(),
      collectionId: video.collectionId || "",
      captions: video.captions || [],
      chapters: video.chapters || [],
      moments: video.moments || [],
    };
  } catch (error) {
    console.error("Error fetching video:", error);
    return null;
  }
}
