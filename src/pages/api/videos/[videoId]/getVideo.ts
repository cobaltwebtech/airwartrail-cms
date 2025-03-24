import type { APIRoute } from "astro";

// This API route handles retrieving video data from Bunny.net
export const GET: APIRoute = async ({ params }) => {
  try {
    const videoId = params.videoId;
    const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;
    const apiKey = import.meta.env.BUNNY_API_KEY;

    const response = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
      {
        headers: {
          AccessKey: apiKey,
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();
    console.log("Bunny.net API response:", JSON.stringify(data, null, 2));
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error fetching video:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch video" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
};
