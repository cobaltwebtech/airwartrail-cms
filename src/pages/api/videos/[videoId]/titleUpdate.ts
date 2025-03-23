import type { APIRoute } from "astro";
import { updateVideoTitle } from "@/lib/bunnyStream";

export const POST: APIRoute = async ({ request }) => {
  const { videoId, newTitle } = await request.json();

  try {
    await updateVideoTitle(videoId, newTitle);
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
