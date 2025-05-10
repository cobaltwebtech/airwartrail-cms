import { R2BucketAWT } from '@/lib/cloudflareR2';
import type { APIRoute } from 'astro';

export const DELETE: APIRoute = async ({ request }) => {
  const body = await request.json() as { fileName?: string };
  const { fileName } = body;

  if (!fileName) {
    return new Response(
      JSON.stringify({ error: 'File name is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    await R2BucketAWT.delete(fileName);

    return new Response(
      JSON.stringify({ message: 'File deleted successfully' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: 'Failed to delete file' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};