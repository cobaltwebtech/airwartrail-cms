import MuxPlayer, { type MuxPlayerRefAttributes } from '@mux/mux-player-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Pencil } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import type { Video } from '@/lib/types';

interface VideoDialogProps {
	video: Video;
	libraryId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isEditing: boolean;
}

export const VideoDialog: React.FC<VideoDialogProps> = ({
	video,
	libraryId,
	open,
	onOpenChange,
}) => {
	const playerRef = useRef<MuxPlayerRefAttributes | null>(null);

	const {
		data: asset,
		isLoading,
		isError,
	} = useQuery(
		trpc.mux.getAsset.queryOptions({
			assetId: video.muxAssetId || video.id,
			libraryId,
		}),
	);

	// Fetch signed tokens only when the video has a "signed" playback policy
	const { data: tokens, isLoading: tokensLoading } = useQuery(
		trpc.mux.generateSignedTokens.queryOptions(
			{
				playbackId: asset?.playbackId ?? '',
				libraryId,
				expiresIn: 3600,
			},
			{
				enabled: !!asset?.playbackId && asset?.policy === 'signed',
			},
		),
	);

	// Fetch chapters for the video
	const { data: chapters } = useQuery(
		trpc.mux.getChapters.queryOptions(
			{ videoId: video.id, libraryId },
			{ enabled: open && !!video.id },
		),
	);

	// Add chapters to the player when they're loaded
	useEffect(() => {
		const player = playerRef.current;
		if (!player || !chapters || chapters.length === 0) return;

		// Wait for metadata to be loaded before adding chapters
		const addChaptersToPlayer = () => {
			if (player.readyState >= 1) {
				// Convert chapters to Mux Player format
				const muxChapters = chapters.map((chapter) => ({
					startTime: chapter.startTime,
					endTime: chapter.endTime ?? undefined,
					value: chapter.title,
				}));
				player.addChapters(muxChapters);
			}
		};

		if (player.readyState >= 1) {
			addChaptersToPlayer();
		} else {
			player.addEventListener('loadedmetadata', addChaptersToPlayer, {
				once: true,
			});
		}

		return () => {
			player.removeEventListener('loadedmetadata', addChaptersToPlayer);
		};
	}, [chapters]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="p-2 sm:max-w-5xl">
				<div className="aspect-video w-full rounded-sm overflow-hidden">
					{isLoading || (asset?.policy === 'signed' && tokensLoading) ? (
						<div>Loading video...</div>
					) : asset?.playbackId ? (
						<MuxPlayer
							ref={playerRef}
							playbackId={asset.playbackId}
							title={asset.title}
							{...(asset.policy === 'signed' && tokens
								? {
										tokens: {
											playback: tokens.playback,
											thumbnail: tokens.thumbnail,
											storyboard: tokens.storyboard,
										},
									}
								: {})}
						/>
					) : isError ? (
						<div>Failed to load video.</div>
					) : null}
				</div>
				<div className="flex flex-row justify-between">
					<DialogHeader className="p-4">
						<DialogTitle>
							<Link
								to="/library/$libraryId/edit-video/$videoId"
								params={{ libraryId, videoId: video.id }}
							>
								{video.title}
							</Link>
						</DialogTitle>
						<DialogDescription>
							Views: <Badge variant="secondary">{video.views}</Badge>
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Link
							to="/library/$libraryId/edit-video/$videoId"
							params={{ libraryId, videoId: video.id }}
						>
							<Button variant="outline" size="icon">
								<Pencil className="size-4" />
							</Button>
						</Link>
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	);
};
