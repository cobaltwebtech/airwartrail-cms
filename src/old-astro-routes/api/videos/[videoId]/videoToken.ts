import type { APIRoute } from "astro";
import crypto from "crypto";

const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;
const bunnyToken = import.meta.env.BUNNY_STREAM_TOKEN;

export const GET: APIRoute = async ({ params }) => {
  const videoId = params.videoId;

  if (!videoId) {
    return new Response(JSON.stringify({ error: "Missing videoId" }), {
      status: 400,
    });
  }

  // Set expiration 3 hours
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 3;

  // Generate token
  const toHash = `${bunnyToken}${videoId}${expires}`;
  const token = crypto.createHash("sha256").update(toHash).digest("hex");

  // Construct signed URL
  const signedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?token=${token}&expires=${expires}&autoplay=false&loop=false&muted=false&preload=true&responsive=true`;

  return new Response(JSON.stringify({ url: signedUrl }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
