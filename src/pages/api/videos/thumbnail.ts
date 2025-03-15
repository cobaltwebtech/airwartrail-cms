import type { APIRoute } from 'astro';

const libraryId = import.meta.env.BUNNY_LIBRARY_ID;
const apiKey = import.meta.env.BUNNY_API_KEY;

export const POST: APIRoute = async ({ params, request }) => {
  const { videoId } = params;
  const formData = new FormData();

  const file = await request.formData().then(data => data.get('file'));

  if (!file) {
    return new Response(JSON.stringify({ message: 'No file uploaded' }), { status: 400 });
  }

  formData.append('file', file);

  try {
    const response = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}/thumbnail`, {
      method: 'POST',
      headers: {
        'AccessKey': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload thumbnail');
    }

    return new Response(JSON.stringify({ message: 'Thumbnail uploaded successfully' }), { status: 200 });
  } catch (error) {
    console.error('Error uploading thumbnail:', error);
    return new Response(JSON.stringify({ message: 'Error uploading thumbnail' }), { status: 500 });
  }
};