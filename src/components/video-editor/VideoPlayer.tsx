import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';

interface VideoPlayerProps {
	videoId: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId }) => {
	const [iframeReady, setIframeReady] = useState(false);
	const previousUrlRef = useRef<string | undefined>(undefined);
	const { data, isLoading, isError } = useQuery(
		trpc.bunny.getVideoToken.queryOptions({ videoId }),
	);

	// Reset iframe ready state when URL changes
	if (data?.url !== previousUrlRef.current) {
		previousUrlRef.current = data?.url;
		if (data?.url) {
			setIframeReady(false);
		}
	}

	const handleIframeLoad = () => {
		// Add a brief delay to allow iframe content to render
		setTimeout(() => {
			setIframeReady(true);
		}, 1000);
	};

	const showSkeleton = isLoading || (data?.url && !iframeReady);

	return (
		<Card className="col-span-4 col-start-5 row-span-2 w-full">
			<CardHeader>
				<CardTitle>Video Preview</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="aspect-video w-full relative">
					{showSkeleton && <Skeleton className="size-full absolute inset-0" />}
					{data?.url ? (
						<iframe
							title="Video Player"
							src={data.url}
							className={`size-full rounded-sm ${iframeReady ? 'opacity-100' : 'opacity-0'}`}
							allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
							allowFullScreen
							onLoad={handleIframeLoad}
						/>
					) : isError ? (
						<Skeleton className="size-full" />
					) : null}
				</div>
			</CardContent>
		</Card>
	);
};

export default VideoPlayer;
