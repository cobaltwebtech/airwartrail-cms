import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;
    const apiKey = import.meta.env.BUNNY_API_KEY;
    const videoId = params.videoId;
    const { chapters } = (await request.json()) as { chapters: unknown };

    const response = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
      {
        method: "POST",
        headers: {
          AccessKey: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chapters }),
      },
    );

    const data = await response.json();
    if (response.ok) {
      return new Response(
        JSON.stringify({ message: "Chapters updated successfully", data }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Failed to update chapters", data }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  } catch (error) {
    console.error("Error updating chapters:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update chapters" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
