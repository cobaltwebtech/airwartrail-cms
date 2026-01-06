import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CheckCircle, CloudOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import VideoEditor from '@/components/video-editor/VideoEditor';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute(
	'/_dashboard/library/$libraryId/edit-video/$videoId',
)({
	component: VideoEditorPage,
	loader: async ({ context: { queryClient }, params }) => {
		const { libraryId, videoId } = params;
		// Prefetch video details
		await queryClient.ensureQueryData(
			trpc.mux.getAsset.queryOptions({ assetId: videoId, libraryId }),
		);
		return { videoId, libraryId };
	},
});

function VideoEditorPage() {
	const { videoId, libraryId } = Route.useParams();
	const queryClient = useQueryClient();

	const {
		data: muxAsset,
		isLoading: videoLoading,
		error: videoError,
	} = useQuery(trpc.mux.getAsset.queryOptions({ assetId: videoId, libraryId }));

	// Check sync status
	const { data: syncStatus, isLoading: syncStatusLoading } = useQuery(
		trpc.mux.getVideoSyncStatus.queryOptions(
			{ muxAssetId: videoId, libraryId },
			{ enabled: !!muxAsset },
		),
	);

	// Sync mutation
	const syncMutation = useMutation(
		trpc.mux.syncSingleAsset.mutationOptions({
			onSuccess: () => {
				toast.success('Video synced to database');
				queryClient.invalidateQueries({
					queryKey: trpc.mux.getVideoSyncStatus.queryKey({
						muxAssetId: videoId,
						libraryId,
					}),
				});
			},
			onError: (error) => {
				toast.error(`Sync failed: ${error.message}`);
			},
		}),
	);

	const handleSync = () => {
		syncMutation.mutate({ muxAssetId: videoId, libraryId });
	};

	// Transform MuxAsset to VideoEditor video format
	const video = muxAsset
		? {
				title: muxAsset.title || 'Untitled',
				duration: muxAsset.duration || 0,
				statusText: muxAsset.status === 'ready' ? 'Ready' : 'Processing',
				views: 0, // Mux doesn't provide view counts
				storageSize: 0, // Mux doesn't provide storage size
				dateUploaded: muxAsset.createdAt || new Date().toISOString(),
				collectionId:
					typeof muxAsset.metadata?.collectionId === 'string'
						? muxAsset.metadata.collectionId
						: undefined,
				captions: muxAsset.captions?.map((cap) => ({
					label: cap.name || cap.language || 'Caption',
					srclang: cap.languageCode || 'en',
				})),
				chapters: Array.isArray(muxAsset.metadata?.chapters)
					? muxAsset.metadata.chapters
					: undefined,
				moments: Array.isArray(muxAsset.metadata?.moments)
					? muxAsset.metadata.moments
					: undefined,
			}
		: null;

	if (videoError) {
		return (
			<div className="text-destructive">
				Error loading video: {videoError.message}
			</div>
		);
	}

	return (
		<>
			<div className="flex items-center justify-between px-4 lg:px-6">
				<Button asChild variant="link" className="px-0">
					<Link to="/library/$libraryId/videos" params={{ libraryId }}>
						&larr; Back to Videos
					</Link>
				</Button>
				{/* Sync Status Indicator */}
				{!syncStatusLoading && syncStatus && (
					<div className="flex items-center gap-2">
						{syncStatus.isSynced ? (
							<span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
								<CheckCircle className="size-4" />
								Synced
							</span>
						) : (
							<div className="flex items-center gap-2">
								<span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
									<CloudOff className="size-4" />
									Not Synced
								</span>
								<Button
									size="sm"
									variant="outline"
									onClick={handleSync}
									disabled={syncMutation.isPending}
								>
									<RefreshCw
										className={`mr-2 size-4 ${syncMutation.isPending ? 'animate-spin' : ''}`}
									/>
									{syncMutation.isPending ? 'Syncing...' : 'Sync to Database'}
								</Button>
							</div>
						)}
					</div>
				)}
			</div>
			<DashboardHeader heading="Video Editor" />
			{videoLoading ? (
				<div className="text-muted-foreground">Loading video details...</div>
			) : video ? (
				<VideoEditor
					video={video}
					videoId={videoId}
					libraryId={libraryId}
					collections={[]}
				/>
			) : (
				<p>Video not found</p>
			)}
		</>
	);
}
