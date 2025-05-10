import { R2BucketAWT } from '@/lib/cloudflareR2';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const prefix = url.searchParams.get('prefix') || '';
    const delimiter = url.searchParams.get('delimiter') || '';
    
    // List objects in the bucket with optional prefix and delimiter
    const listed = await R2BucketAWT.list({
      prefix,
      delimiter: delimiter || undefined,
      limit: 1000, // Adjust based on your needs
    });

    // Format the response
    const files = listed.objects.map(object => ({
      name: object.key,
      size: object.size,
      uploaded: object.uploaded,
      etag: object.etag,
      httpEtag: object.httpEtag,
      url: `/api/assets/file/${encodeURIComponent(object.key)}`,
    }));

    return new Response(JSON.stringify({
      files,
      truncated: listed.truncated,
      prefixes: listed.delimitedPrefixes
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error listing files:', error);
    return new Response(JSON.stringify({
      error: 'Failed to list files'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};