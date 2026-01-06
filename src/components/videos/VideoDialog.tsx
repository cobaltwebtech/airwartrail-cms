import MuxPlayer from '@mux/mux-player-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Pencil } from 'lucide-react';
import type React from 'react';
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
import { formatDate } from '@/lib/video-helpers';

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
	const {
		data: asset,
		isLoading,
		isError,
	} = useQuery(
		trpc.mux.getAsset.queryOptions({ assetId: video.id, libraryId }),
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

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="p-2 sm:max-w-5xl">
				<div className="aspect-video w-full">
					{isLoading || (asset?.policy === 'signed' && tokensLoading) ? (
						<div>Loading video...</div>
					) : asset?.playbackId ? (
						<MuxPlayer
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
							Uploaded on{' '}
							<span className="capitalize">
								{formatDate(video.dateUploaded)}
							</span>
						</DialogDescription>
						<DialogDescription>
							Views:{' '}
							<span className="text-primary bg-secondary rounded-sm px-2 py-1 font-bold">
								{video.views}
							</span>
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
