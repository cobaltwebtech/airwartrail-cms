import type { APIRoute } from 'astro';

// Make POST request to Bunny.net Stream API to create a new video
export const POST: APIRoute = async ({ request }) => {
	try {
		const libraryId = import.meta.env.VITE_BUNNY_LIBRARY_ID;
		const apiKey = import.meta.env.BUNNY_API_KEY;

		if (!libraryId || !apiKey) {
			console.error(
				'Missing environment variables: BUNNY_LIBRARY_ID or BUNNY_API_KEY',
			);
			return new Response(
				JSON.stringify({ error: 'Server configuration error' }),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}

		const body = await request.json();
		console.log('Creating video with data:', body);

		const response = await fetch(
			`https://video.bunnycdn.com/library/${libraryId}/videos`,
			{
				method: 'POST',
				headers: {
					AccessKey: apiKey,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Bunny.net API error (${response.status}): ${errorText}`);
			return new Response(
				JSON.stringify({
					error: 'Failed to create video on Bunny.net',
					details: errorText,
				}),
				{
					status: response.status,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}

		const data = await response.json();
		console.log('Video created successfully:', data);

		return new Response(JSON.stringify(data), {
			status: 201,
			headers: {
				'Content-Type': 'application/json',
			},
		});
	} catch (error) {
		console.error('Error creating video:', error);
		return new Response(
			JSON.stringify({
				error: 'Failed to create video',
				details: (error as Error).message,
			}),
			{
				status: 500,
				headers: {
					'Content-Type': 'application/json',
				},
			},
		);
	}
};

// Make GET request to Bunny.net Stream API to generate an authorization signature
export const GET: APIRoute = async ({ request }) => {
	try {
		// Get environmental variables
		const libraryId = import.meta.env.VITE_BUNNY_LIBRARY_ID;
		const apiKey = import.meta.env.BUNNY_API_KEY;
		const url = new URL(request.url);
		const videoId = url.searchParams.get('videoId');

		if (!libraryId || !apiKey) {
			console.error(
				'Missing environmental variables: VITE_BUNNY_LIBRARY_ID or BUNNY_API_KEY',
			);
			return new Response(
				JSON.stringify({ error: 'Server configuration error' }),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}

		// Validation for video GUID format
		if (
			!videoId ||
			!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
				videoId,
			)
		) {
			return new Response(
				JSON.stringify({ error: 'Invalid video ID format' }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}

		// Calculate expiration time (6 hours)
		const expire = Math.floor(Date.now() / 1000) + 21600;

		if (!videoId) {
			return new Response(
				JSON.stringify({ error: 'Missing videoId parameter' }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}
		// Video data passed into encoder to generate the SHA256 signature
		const generateSignature = async (
			libraryId: string,
			apiKey: string,
			expire: number,
			videoId: string,
		) => {
			const message = `${libraryId}${apiKey}${expire}${videoId}`;
			const encoder = new TextEncoder();
			const data = encoder.encode(message);
			const hash = await crypto.subtle.digest('SHA-256', data);
			return Array.from(new Uint8Array(hash))
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('');
		};

		const signature = await generateSignature(
			libraryId,
			apiKey,
			expire,
			videoId,
		);

		return new Response(
			JSON.stringify({ token: apiKey, signature, expire, videoId }),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			},
		);
	} catch (error) {
		console.error('Error generating upload token:', error);
		return new Response(
			JSON.stringify({
				error: 'Failed to generate upload token',
				details: (error as Error).message,
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			},
		);
	}
};
