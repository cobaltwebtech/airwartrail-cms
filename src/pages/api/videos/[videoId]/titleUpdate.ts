import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  const { videoId, newTitle } = await request.json();

  try {
    const apiKey = import.meta.env.BUNNY_API_KEY;
    const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;
    const response = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
      {
        method: "POST",
        headers: {
          AccessKey: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: newTitle }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update video title: ${errorText}`);
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, message: errorMessage }),
      { status: 500 },
    );
  }
};
