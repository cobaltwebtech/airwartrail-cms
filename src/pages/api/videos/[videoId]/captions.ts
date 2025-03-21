import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ params, request }) => {
  const videoId = params.videoId;

  if (!videoId) {
    return new Response(
      JSON.stringify({ success: false, message: "Video ID is required" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  try {
    // Get the API key and library ID from environment variables
    const apiKey = import.meta.env.BUNNY_API_KEY;
    const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;

    if (!apiKey || !libraryId) {
      throw new Error("Missing Bunny.net API credentials");
    }

    // Get the form data from the request
    const formData = await request.formData();
    const file = formData.get("file");
    const label = formData.get("label");
    const srclang = formData.get("srclang");

    if (!file || !(file instanceof Blob)) {
      return new Response(
        JSON.stringify({ success: false, message: "No file uploaded" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    if (!label || !srclang) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Label and Language Code are required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Validate file type
    const validExtensions = [".srt", ".vtt"];
    const fileExtension = file.name
      .slice(file.name.lastIndexOf("."))
      .toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "File must be a .srt or .vtt file",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Get file data as ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    // Encode file data to base64 using native JavaScript
    const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

    // Upload the caption to Bunny.net
    const uploadResponse = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}/captions/${srclang}`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          AccessKey: apiKey,
        },
        body: JSON.stringify({
          srclang: srclang.toString(),
          label: label.toString(),
          captionsFile: base64File,
        }),
      },
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Bunny.net API error response:", errorText);
      throw new Error(`Bunny.net API error: ${errorText}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Caption uploaded successfully",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("Error uploading caption:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  const videoId = params.videoId;
  const url = new URL(request.url);
  const srclang = url.searchParams.get("srclang");

  if (!videoId || !srclang) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Video ID and Language Code are required",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  try {
    // Get the API key and library ID from environment variables
    const apiKey = import.meta.env.BUNNY_API_KEY;
    const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;

    if (!apiKey || !libraryId) {
      throw new Error("Missing Bunny.net API credentials");
    }

    // Delete the caption from Bunny.net
    const deleteResponse = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}/captions/${srclang}`,
      {
        method: "DELETE",
        headers: {
          AccessKey: apiKey,
        },
      },
    );

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error("Bunny.net API error response:", errorText);
      throw new Error(`Bunny.net API error: ${errorText}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Caption deleted successfully",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("Error deleting caption:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
};

// Add OPTIONS handler for CORS preflight requests
export const OPTIONS: APIRoute = () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, AccessKey, Label, srclang",
    },
  });
};
