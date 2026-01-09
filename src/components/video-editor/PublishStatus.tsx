import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/lib/trpc';

interface PublishStatusProps {
	videoId: string;
	libraryId?: string;
	initialPublishStatus?: boolean;
	onPublishStatusUpdate?: (isPublished: boolean) => void;
}

const PublishStatus: React.FC<PublishStatusProps> = ({
	videoId,
	libraryId,
	initialPublishStatus = false,
	onPublishStatusUpdate,
}) => {
	const queryClient = useQueryClient();
	const [isPublished, setIsPublished] = useState(initialPublishStatus);

	// Query the local database for the video publish status
	const { data: videoData } = useQuery(
		trpc.mux.getVideoFromDatabase.queryOptions({
			muxAssetId: videoId,
			libraryId,
		}),
	);

	// Update publish status when data is loaded from database
	useEffect(() => {
		if (videoData?.isPublished !== undefined) {
			setIsPublished(videoData.isPublished);
		}
	}, [videoData]);

	const updatePublishStatusMutation = useMutation(
		trpc.mux.updateVideoMetadata.mutationOptions({
			onSuccess: () => {
				const status = isPublished ? 'published' : 'unpublished';
				toast.success(`Video ${status} successfully`);
				// Invalidate queries to refresh data
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getAsset']],
				});
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getVideoFromDatabase']],
				});
				if (onPublishStatusUpdate) {
					onPublishStatusUpdate(isPublished);
				}
			},
			onError: (err) => {
				// Revert the switch on error
				setIsPublished(!isPublished);
				const errorMessage =
					err instanceof Error ? err.message : 'Unknown error';
				toast.error('Failed to update publish status');
				console.error('Update publish status error:', errorMessage);
			},
		}),
	);

	const handleToggle = (checked: boolean) => {
		// Optimistically update the UI
		setIsPublished(checked);

		// Update via tRPC - saves to local database
		updatePublishStatusMutation.mutate({
			muxAssetId: videoId,
			libraryId,
			isPublished: checked,
			publishedAt: checked ? new Date().toISOString() : null,
		});
	};

	return (
		<Card className="col-span-4">
			<CardHeader>
				<CardTitle>Publish Status</CardTitle>
				<CardDescription>
					{isPublished
						? 'This video is currently published and visible to viewers'
						: 'This video is currently unpublished and not visible to viewers'}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex items-center justify-between">
				<div className="space-y-0.5">
					<label
						htmlFor="publish-switch"
						className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
					>
						{isPublished ? (
							<>
								<Eye className="size-4 text-accent" />
								Published
							</>
						) : (
							<>
								<EyeOff className="size-4 text-muted-foreground" />
								Unpublished
							</>
						)}
					</label>
					<p className="text-sm text-muted-foreground">
						{isPublished
							? 'Video is live and accessible'
							: 'Video is hidden from viewers'}
					</p>
				</div>
				<Switch
					id="publish-switch"
					checked={isPublished}
					onCheckedChange={handleToggle}
					disabled={updatePublishStatusMutation.isPending}
					aria-label="Toggle publish status"
				/>
			</CardContent>
		</Card>
	);
};

export default PublishStatus;
