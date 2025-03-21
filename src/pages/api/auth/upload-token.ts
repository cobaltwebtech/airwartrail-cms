import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  try {
    // Get environmental variables
    const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;
    const apiKey = import.meta.env.BUNNY_API_KEY;
    const url = new URL(request.url);
    const videoId = url.searchParams.get("videoId");

    if (!libraryId || !apiKey) {
      console.error(
        "Missing environment variables: PUBLIC_BUNNY_LIBRARY_ID or BUNNY_API_KEY",
      );
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Validation for video GUID format
    if (
      !videoId ||
      !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        videoId,
      )
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid video ID format" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Calculate expiration time (24 hours from now)
    const expire = Math.floor(Date.now() / 1000) + 86400;

    // Generate the AuthorizationSignature
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: "Missing videoId parameter" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    const signature = await generateSignature(
      libraryId,
      apiKey,
      expire,
      videoId,
    );

    return new Response(
      JSON.stringify({ token: apiKey, signature, expire, videoId }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error generating upload token:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate upload token",
        details: (error as Error).message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

// Function to generate the SHA256 signature
const generateSignature = async (
  libraryId: string,
  apiKey: string,
  expire: number,
  videoId: string,
) => {
  const message = `${libraryId}${apiKey}${expire}${videoId}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};
