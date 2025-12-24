import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  const { videoId, newCollection } = (await request.json()) as {
    videoId: string;
    newCollection: string;
  };

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
        body: JSON.stringify({ collectionId: newCollection }),
      },
    );

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`Failed to update collection title: ${responseText}`);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error updating collection:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, message: errorMessage }),
      { status: 500 },
    );
  }
};
