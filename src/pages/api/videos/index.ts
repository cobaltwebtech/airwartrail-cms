import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  try {
    const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;
    const apiKey = import.meta.env.BUNNY_API_KEY;

    if (!libraryId || !apiKey) {
      console.error(
        "Missing environment variables: BUNNY_LIBRARY_ID or BUNNY_API_KEY",
      );
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const response = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos`,
      {
        headers: {
          AccessKey: apiKey,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Bunny.net API error (${response.status}): ${errorText}`);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch videos from Bunny.net",
          details: errorText,
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error fetching videos:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch videos",
        details: (error as Error).message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;
    const apiKey = import.meta.env.BUNNY_API_KEY;

    if (!libraryId || !apiKey) {
      console.error(
        "Missing environment variables: BUNNY_LIBRARY_ID or BUNNY_API_KEY",
      );
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const body = await request.json();
    console.log("Creating video with data:", body);

    const response = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos`,
      {
        method: "POST",
        headers: {
          AccessKey: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Bunny.net API error (${response.status}): ${errorText}`);
      return new Response(
        JSON.stringify({
          error: "Failed to create video on Bunny.net",
          details: errorText,
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const data = await response.json();
    console.log("Video created successfully:", data);

    return new Response(JSON.stringify(data), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error creating video:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to create video",
        details: (error as Error).message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
