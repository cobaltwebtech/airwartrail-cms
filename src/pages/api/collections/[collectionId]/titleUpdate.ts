import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ params, request }) => {
  const collectionId = params.collectionId;
  const name = await request.json();

  try {
    const apiKey = import.meta.env.BUNNY_API_KEY;
    const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;
    const response = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/collections/${collectionId}`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          AccessKey: apiKey,
        },
        body: JSON.stringify(name),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error from Bunny", errorData);

      return new Response(JSON.stringify({ error: errorData.message }), {
        status: response.status,
      });
    }

    const result = await response.json();
    return new Response(
      JSON.stringify({ message: "Title updated successfully", data: result }),
      { status: 200 },
    );
  } catch (error) {
    console.error("Error updating title:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
};
