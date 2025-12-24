import type { APIRoute } from 'astro';

// This API route handles deleting a video collection from Bunny.net
export const DELETE: APIRoute = async ({ params }) => {
	try {
		const collectionId = params.collectionId;
		const libraryId = import.meta.env.VITE_BUNNY_LIBRARY_ID;
		const apiKey = import.meta.env.BUNNY_API_KEY;

		const response = await fetch(
			`https://video.bunnycdn.com/library/${libraryId}/collections/${collectionId}`,
			{
				method: 'DELETE',
				headers: {
					AccessKey: apiKey,
				},
			},
		);

		// Bunny.net returns 204 No Content on successful deletion
		if (response.status === 204) {
			return new Response(null, { status: 204 });
		}

		const data = await response.json();
		return new Response(JSON.stringify(data), {
			status: response.status,
			headers: {
				'Content-Type': 'application/json',
			},
		});
	} catch (error) {
		console.error('Error deleting collection:', error);
		return new Response(
			JSON.stringify({ error: 'Failed to delete collection' }),
			{
				status: 500,
				headers: {
					'Content-Type': 'application/json',
				},
			},
		);
	}
};
