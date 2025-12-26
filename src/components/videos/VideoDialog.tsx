import { useQuery } from '@tanstack/react-query';
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
import { formatDate } from '@/lib/video-helpers';
import type { Video } from '@/types';

interface VideoDialogProps {
	video: Video;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isEditing: boolean;
}

export const VideoDialog: React.FC<VideoDialogProps> = ({
	video,
	open,
	onOpenChange,
}) => {
	const { data, isLoading, isError } = useQuery(
		trpc.bunny.getVideoToken.queryOptions({ videoId: video.id }),
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="p-2 sm:max-w-5xl">
				<div className="aspect-video w-full">
					{isLoading ? (
						<div>Loading video...</div>
					) : data?.url ? (
						<iframe
							title={video.title}
							src={data.url}
							className="h-full w-full"
							allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
							allowFullScreen
						></iframe>
					) : isError ? (
						<div>Failed to load video.</div>
					) : null}
				</div>
				<div className="flex flex-row justify-between">
					<DialogHeader className="p-4">
						<DialogTitle>
							<a href={`/edit-video/${video.id}`}>{video.title}</a>
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
						<a href={`/edit-video/${video.id}`}>
							<Button variant="outline" size="icon">
								<Pencil className="size-4" />
							</Button>
						</a>
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	);
};
