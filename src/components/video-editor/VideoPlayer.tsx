import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/trpc';

interface VideoPlayerProps {
	videoId: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId }) => {
	const { data, isLoading, isError } = useQuery(
		trpc.bunny.getVideoToken.queryOptions({ videoId }),
	);

	return (
		<Card className="col-span-4 col-start-5 row-span-2 w-full">
			<CardHeader>
				<CardTitle>Video Preview</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="aspect-video w-full">
					{isLoading ? (
						<div>Loading video...</div>
					) : data?.url ? (
						<iframe
							title="Video Player"
							src={data.url}
							className="h-full w-full"
							allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
							allowFullScreen
						></iframe>
					) : isError ? (
						<div>Failed to load video.</div>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
};

export default VideoPlayer;
