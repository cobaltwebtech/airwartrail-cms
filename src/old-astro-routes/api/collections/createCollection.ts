import type { APIRoute } from "astro";

const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;
const apiKey = import.meta.env.BUNNY_API_KEY;

export const POST: APIRoute = async ({ request }) => {
  const { name } = (await request.json()) as { name?: string };

  if (!name) {
    return new Response(JSON.stringify({ error: "Name is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/collections`,
      {
        method: "POST",
        headers: {
          AccessKey: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage =
        typeof errorData === "object" &&
        errorData !== null &&
        "message" in errorData &&
        typeof (errorData as { message?: unknown }).message === "string"
          ? (errorData as { message: string }).message
          : "Failed to create collection";
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
