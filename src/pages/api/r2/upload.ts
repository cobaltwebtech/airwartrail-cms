import { R2BucketAWT } from "@/lib/cloudflareR2";
import type { APIRoute } from "astro";

// Define CORS headers for reuse
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Or your specific domain in production
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Requested-With, Authorization",
};

// Define CSRF protection middleware
function validateCsrf(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const xRequestedWith = request.headers.get("x-requested-with");

  // Valid XMLHttpRequest header indicates a legitimate AJAX request
  if (xRequestedWith === "XMLHttpRequest") {
    return true;
  }

  // For local development
  if (origin?.includes("localhost") || referer?.includes("localhost")) {
    return true;
  }

  // For production, check against your actual domain
  // if (origin && origin.includes("your-domain.com")) {
  //   return true;
  // }

  // During development, we're being permissive
  return true;
}

export const POST: APIRoute = async ({ request, locals }) => {
  // Handle OPTIONS requests for CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Validate CSRF token
  if (!validateCsrf(request)) {
    console.log("CSRF validation failed");
    return new Response(JSON.stringify({ error: "CSRF validation failed" }), {
      status: 403,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to R2
    await R2BucketAWT.put(locals.runtime.env, file.name, buffer, {
      httpMetadata: { contentType: file.type },
    });

    return new Response(
      JSON.stringify({ message: "File uploaded successfully" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (error) {
    console.error("Error uploading file:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to upload file",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }
};
