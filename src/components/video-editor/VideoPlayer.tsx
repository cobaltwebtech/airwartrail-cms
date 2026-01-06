import MuxPlayer from '@mux/mux-player-react';
import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';

interface VideoPlayerProps {
	videoId: string;
	libraryId?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId, libraryId }) => {
	const {
		data: video,
		isLoading,
		isError,
	} = useQuery(trpc.mux.getAsset.queryOptions({ assetId: videoId, libraryId }));

	// Fetch tokens for signed videos using tRPC client
	const { data: tokens, isLoading: tokensLoading } = useQuery(
		trpc.mux.generateSignedTokens.queryOptions(
			{
				playbackId: video?.playbackId || '',
				libraryId,
				expiresIn: 3600,
			},
			{
				enabled: video?.policy === 'signed' && Boolean(video?.playbackId),
			},
		),
	);

	if (isLoading) {
		return (
			<Card className="col-span-4 col-start-5 row-span-2 w-full">
				<CardHeader>
					<CardTitle>Video Preview</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="aspect-video w-full">
						<Skeleton className="size-full rounded-sm" />
					</div>
				</CardContent>
			</Card>
		);
	}

	if (isError || !video?.playbackId) {
		return (
			<Card className="col-span-4 col-start-5 row-span-2 w-full">
				<CardHeader>
					<CardTitle>Video Preview</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="aspect-video w-full rounded-sm bg-muted flex items-center justify-center">
						<p className="text-sm text-muted-foreground">
							Unable to load video
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	// For signed videos, wait for tokens to be generated
	if (video.policy === 'signed' && tokensLoading) {
		return (
			<Card className="col-span-4 col-start-5 row-span-2 w-full">
				<CardHeader>
					<CardTitle>Video Preview</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="aspect-video w-full">
						<Skeleton className="size-full rounded-sm" />
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="col-span-4 col-start-5 row-span-2 w-full">
			<CardHeader>
				<CardTitle>Video Preview</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="aspect-video w-full rounded-sm overflow-hidden">
					<MuxPlayer
						playbackId={video.playbackId}
						title={video.title}
						streamType="on-demand"
						tokens={
							video.policy === 'signed' && tokens
								? {
										playback: tokens.playback,
										thumbnail: tokens.thumbnail,
										storyboard: tokens.storyboard,
									}
								: undefined
						}
						className="size-full object-contain"
					/>
				</div>
			</CardContent>
		</Card>
	);
};

export default VideoPlayer;
