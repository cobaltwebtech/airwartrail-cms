import MuxPlayer, { type MuxPlayerRefAttributes } from '@mux/mux-player-react';
import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useEffect, useEffectEvent, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';

interface VideoPlayerProps {
	muxAssetId: string; // Mux Asset ID for fetching video from Mux
	libraryId?: string;
	internalVideoId?: string; // Internal database ID for chapters (optional)
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
	muxAssetId,
	libraryId,
	internalVideoId,
}) => {
	const playerRef = useRef<MuxPlayerRefAttributes | null>(null);

	const {
		data: video,
		isLoading,
		isError,
	} = useQuery(
		trpc.mux.getAsset.queryOptions({ assetId: muxAssetId, libraryId }),
	);

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

	// Fetch chapters for the video using internal ID if available
	const { data: chapters, isLoading: chaptersLoading } = useQuery(
		trpc.mux.getChapters.queryOptions(
			{ videoId: internalVideoId || '', libraryId },
			{ enabled: !!internalVideoId },
		),
	);

	// Effect Event to add chapters - always reads latest chapters without causing re-runs
	const onLoadedMetadata = useEffectEvent(() => {
		const player = playerRef.current;
		if (!player || !chapters || chapters.length === 0 || chaptersLoading)
			return;

		// Convert chapters to Mux Player format
		const muxChapters = chapters.map((chapter) => ({
			startTime: chapter.startTime,
			endTime: chapter.endTime ?? undefined,
			value: chapter.title,
		}));

		// Add chapters to the player
		player.addChapters(muxChapters);
	});

	// Add chapters when player loads metadata, re-run only when video changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: muxAssetId triggers re-setup when video changes, onLoadedMetadata is an Effect Event
	useEffect(() => {
		const player = playerRef.current;
		if (!player) return;

		const handleMetadata = () => onLoadedMetadata();

		player.addEventListener('loadedmetadata', handleMetadata);

		// If already loaded, add chapters immediately
		if (player.readyState >= 1) {
			onLoadedMetadata();
		}

		return () => {
			player.removeEventListener('loadedmetadata', handleMetadata);
		};
	}, [muxAssetId, onLoadedMetadata]);

	if (isLoading) {
		return (
			<Card className="col-span-4 col-start-5 w-full">
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
			<Card className="col-span-4 col-start-5 w-full">
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
						ref={playerRef}
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
