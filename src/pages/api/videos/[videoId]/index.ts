import type { APIRoute } from "astro"

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const videoId = params.videoId

    const response = await fetch(
      `https://video.bunnycdn.com/library/${import.meta.env.PUBLIC_BUNNY_LIBRARY_ID}/videos/${videoId}`,
      {
        headers: {
          AccessKey: import.meta.env.BUNNY_API_KEY as string,
          "Content-Type": "application/json",
        },
      },
    )

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("Error fetching video:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch video" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }
}

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const videoId = params.videoId

    const response = await fetch(
      `https://video.bunnycdn.com/library/${import.meta.env.PUBLIC_BUNNY_LIBRARY_ID}/videos/${videoId}`,
      {
        method: "DELETE",
        headers: {
          AccessKey: import.meta.env.BUNNY_API_KEY as string,
        },
      },
    )

    // Bunny.net returns 204 No Content on successful deletion
    if (response.status === 204) {
      return new Response(null, { status: 204 })
    }

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("Error deleting video:", error)
    return new Response(JSON.stringify({ error: "Failed to delete video" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }
}

