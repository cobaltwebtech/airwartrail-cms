import { R2BucketAWT } from "@/lib/cloudflareR2";
import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) => {
  try {
    const formData = await context.request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response(JSON.stringify({ message: "No file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const fileBuffer = await file.arrayBuffer();
    const fileName = (formData.get("fileName") as string) || file.name;

    await R2BucketAWT.put(context.locals.runtime.env, fileName, fileBuffer, {
      httpMetadata: { contentType: file.type },
    });

    return new Response(
      JSON.stringify({ message: "File uploaded successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Upload error:", error);
    return new Response(JSON.stringify({ message: "Error uploading file" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
