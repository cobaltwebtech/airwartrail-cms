import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;
    const apiKey = import.meta.env.BUNNY_API_KEY;
    const videoId = params.videoId;
    const { moments } = await request.json();

    const response = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
      {
        method: "POST",
        headers: {
          AccessKey: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ moments }),
      },
    );

    const data = await response.json();
    if (response.ok) {
      return new Response(
        JSON.stringify({ message: "Moments updated successfully", data }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Failed to update moments", data }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  } catch (error) {
    console.error("Error updating moments:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update moments" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
