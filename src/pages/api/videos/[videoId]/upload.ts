import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ params }) => {
  try {
    const videoId = params.videoId;
    
    if (!videoId) {
      return new Response(JSON.stringify({ error: "Video ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Get the upload URL from Bunny.net
    const response = await fetch(
      `https://video.bunnycdn.com/library/${import.meta.env.BUNNY_LIBRARY_ID}/videos/${videoId}/upload`,
      {
        headers: {
          "AccessKey": import.meta.env.BUNNY_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Bunny.net API error:", errorText);
      return new Response(JSON.stringify({ 
        error: "Failed to get upload URL from Bunny.net",
        details: errorText
      }), {
        status: response.status,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error getting upload URL:", error);
    return new Response(JSON.stringify({ 
      error: "Failed to get upload URL",
      details: (error as Error).message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};