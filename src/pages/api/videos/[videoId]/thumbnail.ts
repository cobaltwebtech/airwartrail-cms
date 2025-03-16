import type { APIRoute } from "astro"

export const POST: APIRoute = async ({ params, request }) => {
  const videoId = params.videoId

  if (!videoId) {
    return new Response(JSON.stringify({ success: false, message: "Video ID is required" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    })
  }

  try {
    // Get the API key and library ID from environment variables
    const apiKey = import.meta.env.BUNNY_API_KEY
    const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID

    if (!apiKey || !libraryId) {
      throw new Error("Missing Bunny.net API credentials")
    }

    // Get the form data from the request
    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof Blob)) {
      return new Response(JSON.stringify({ success: false, message: "No file uploaded" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      })
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      return new Response(JSON.stringify({ success: false, message: "File must be an image" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      })
    }

    // Get file data as ArrayBuffer
    const fileBuffer = await file.arrayBuffer()

    // Upload the thumbnail to Bunny.net
    const uploadResponse = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}/thumbnail`, {
      method: "POST",
      headers: {
        AccessKey: apiKey,
        "Content-Type": file.type,
      },
      // Use the ArrayBuffer directly instead of converting to Buffer
      body: fileBuffer,
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error("Bunny.net API error response:", errorText)
      throw new Error(`Bunny.net API error: ${errorText}`)
    }

    return new Response(JSON.stringify({ success: true, message: "Thumbnail uploaded successfully" }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    console.error("Error uploading thumbnail:", error)
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    )
  }
}

// Add OPTIONS handler for CORS preflight requests
export const OPTIONS: APIRoute = ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, AccessKey",
    },
  })
}
