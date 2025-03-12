import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  try {
    // Get environment variables
    const apiKey = import.meta.env.BUNNY_API_KEY;
    
    if (!apiKey) {
      console.error("Missing environment variable: BUNNY_API_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Return the API key as the token
    return new Response(JSON.stringify({ token: apiKey }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error generating upload token:", error);
    return new Response(JSON.stringify({ 
      error: "Failed to generate upload token",
      details: (error as Error).message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};