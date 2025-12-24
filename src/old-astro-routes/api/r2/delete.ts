import { R2BucketAWT } from "@/lib/cloudflareR2";
import type { APIRoute } from "astro";

export const DELETE: APIRoute = async (context) => {
  const body = (await context.request.json()) as {
    fileName?: string;
    fileNames?: string[];
  };

  const { fileName, fileNames } = body;

  // Handle single file deletion
  if (fileName) {
    try {
      await R2BucketAWT.delete(context.locals.runtime.env, fileName);

      return new Response(
        JSON.stringify({ message: "File deleted successfully" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch {
      return new Response(JSON.stringify({ error: "Failed to delete file" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Handle bulk deletion
  else if (fileNames && Array.isArray(fileNames) && fileNames.length > 0) {
    try {
      const results = await Promise.allSettled(
        fileNames.map((name) =>
          R2BucketAWT.delete(context.locals.runtime.env, name),
        ),
      );

      const successful = results.filter((r) => r.status === "fulfilled").length;

      return new Response(
        JSON.stringify({
          message: `${successful} of ${fileNames.length} files deleted successfully`,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch {
      return new Response(JSON.stringify({ error: "Failed to delete files" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // No valid input provided
  else {
    return new Response(JSON.stringify({ error: "File name(s) required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};
