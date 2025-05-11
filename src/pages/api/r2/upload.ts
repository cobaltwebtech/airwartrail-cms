import { R2BucketAWT } from "@/lib/cloudflareR2";
import type { APIRoute } from "astro";

// Define CORS headers for reuse
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Or your specific domain in production
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Requested-With, Authorization",
};

// Define environment-aware CSRF protection
function validateCsrf(request: Request): boolean {
  const origin = request.headers.get("origin");
  const xRequestedWith = request.headers.get("x-requested-with");

  // Check if this is a development environment
  const isDev = import.meta.env.DEV;

  // In development mode, be permissive
  if (isDev) {
    return true;
  }

  // In production:
  // Valid XMLHttpRequest header indicates a legitimate AJAX request
  if (xRequestedWith === "XMLHttpRequest") {
    return true;
  }

  // In production, only accept requests from your domain
  const allowedDomains = ["airwartrail.com", "dashboard.airwartrail.com"]; // Replace with your actual domains
  if (origin && allowedDomains.some((domain) => origin.includes(domain))) {
    return true;
  }

  // Otherwise reject
  return false;
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
