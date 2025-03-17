// This file contains functions to interact with the Bunny.net Stream API

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

// For server-side API calls
const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;
const bunnyCdn = import.meta.env.PUBLIC_BUNNY_STREAM_CDN;
const apiKey = import.meta.env.BUNNY_API_KEY;

//Bunny Stream video status numbers referenced to text values
const statusMap: Record<VideoStatus, string> = {
  0: "Created",
  1: "Uploaded",
  2: "Processing",
  3: "Transcoding",
  4: "Finished",
  5: "Error",
  6: "UploadFailed",
  7: "JitSegmenting",
  8: "JitPlaylistsCreated"
};

// Helper function to generate thumbnail URL
function getThumbnailUrl(video: Video): string {
  if (video.thumbnailFileName && video.guid) {
    return `https://${bunnyCdn}/${video.guid}/${video.thumbnailFileName}`;
  }
  return "/placeholder.svg?height=720&width=1280";
}

export async function getVideos(): Promise<Video[]> {
  try {
    // Make the API call to Bunny.net Stream service
    const response = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
      headers: {
        "AccessKey": apiKey,
        "Content-Type": "application/json"
      }
    });
    
    const data = await response.json();
    console.log("Bunny.net API response:", JSON.stringify(data, null, 2));
    
    // Check the structure of the response
    if (Array.isArray(data)) {
      // If the response is already an array, map it to our Video interface
      return data.map((video) => ({
        id: video.guid || video.id,
        guid: video.guid,
        title: video.title,
        thumbnail: getThumbnailUrl(video),
        duration: video.length || 0,
        status: video.status as VideoStatus,
        statusText: statusMap[video.status as VideoStatus] || "Unknown",
        createdAt: video.dateUploaded || new Date().toISOString()
      }));
    } else if (data.items && Array.isArray(data.items)) {
      // If the response has an items property that is an array
      return data.items.map((video) => ({
        id: video.guid || video.id,
        guid: video.guid,
        title: video.title,
        thumbnail: getThumbnailUrl(video),
        duration: video.length || 0,
        status: video.status as VideoStatus,
        statusText: statusMap[video.status as VideoStatus] || "Unknown",
        createdAt: video.dateUploaded || new Date().toISOString()
      }));
    } else if (data.videos && Array.isArray(data.videos)) {
      // If the response has a videos property that is an array
      return data.videos.map((video) => ({
        id: video.guid || video.id,
        guid: video.guid,
        title: video.title,
        thumbnail: getThumbnailUrl(video),
        duration: video.length || 0,
        status: video.status as VideoStatus,
        statusText: statusMap[video.status as VideoStatus] || "Unknown",
        createdAt: video.dateUploaded || new Date().toISOString()
      }));
    }
    
    // If we can't determine the structure, log it and return an empty array
    console.error("Unexpected API response structure:", data);
    return [];
  } catch (error) {
    console.error("Error fetching videos:", error);
    return [];
  }
}

export async function getVideo(videoId: string): Promise<Video | null> {
  try {
    const response = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
      headers: {
        "AccessKey": apiKey,
        "Content-Type": "application/json"
      }
    });
    
    const video = await response.json();
    
    return {
      id: video.guid || video.id,
      guid: video.guid,
      title: video.title,
      thumbnail: getThumbnailUrl(video),
      duration: video.length || 0,
      status: video.status as VideoStatus,
      statusText: statusMap[video.status as VideoStatus] || "Unknown",
      createdAt: video.dateUploaded || new Date().toISOString()
    };
  } catch (error) {
    console.error("Error fetching video:", error);
    return null;
  }
}

export async function updateVideoTitle(videoId: string, newTitle: string): Promise<void> {
  try {
    const response = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
      method: "POST",
      headers: {
        "AccessKey": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ title: newTitle })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update video title: ${errorText}`);
    }
  } catch (error) {
    console.error("Error updating video title:", error);
    throw error;
  }
}
