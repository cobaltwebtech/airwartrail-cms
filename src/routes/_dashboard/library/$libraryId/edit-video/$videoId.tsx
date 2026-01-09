import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CheckCircle, CloudOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Badge } from '@/components/ui/badge';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
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

	// Fetch view count from Mux Data API
	const { data: viewCountData } = useQuery(
		trpc.mux.getAssetViewCount.queryOptions(
			{ muxAssetId: videoId, libraryId },
			{ enabled: !!muxAsset },
		),
	);

	// Check sync status
	const { data: syncStatus, isLoading: syncStatusLoading } = useQuery(
		trpc.mux.getVideoSyncStatus.queryOptions(
			{ muxAssetId: videoId, libraryId },
			{ enabled: !!muxAsset },
		),
	);

	// Fetch library details to get library name
	const { data: library } = useQuery(
		trpc.mux.getLibrary.queryOptions({ libraryId }, { enabled: !!libraryId }),
	);

	// Fetch video data from database
	const { data: videoData } = useQuery(
		trpc.mux.getVideoFromDatabase.queryOptions(
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
				views: viewCountData?.views ?? 0,
				dateUploaded: muxAsset.createdAt || new Date().toISOString(),
				isPublished: Boolean(muxAsset.metadata?.isPublished),
				captions: muxAsset.captions?.map((cap) => ({
					label: cap.name || cap.language || 'Caption',
					srclang: cap.languageCode || 'en',
				})),
				resolutionTier: muxAsset.resolutionTier,
				aspectRatio: muxAsset.aspectRatio,
				videoQuality: muxAsset.videoQuality,
				maxStoredFrameRate: muxAsset.maxStoredFrameRate,
				maxWidth: muxAsset.maxWidth,
				maxHeight: muxAsset.maxHeight,
				id: videoData?.id,
				muxAssetId: videoData?.muxAssetId,
				muxPlaybackId: videoData?.muxPlaybackId ?? undefined,
				muxEnvironmentId: library?.muxEnvironmentId ?? undefined,
				createdAt: videoData?.createdAt.toISOString(),
				updatedAt: videoData?.updatedAt.toISOString(),
				viewCountSyncedAt: videoData?.viewCountSyncedAt?.toISOString(),
				libraryName: library?.name,
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
			<DashboardHeader heading="Video Editor">
				<div className="flex justify-between items-center py-4">
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink href="/">All Libraries</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbLink asChild>
									<Link to="/library/$libraryId/videos" params={{ libraryId }}>
										Videos
									</Link>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>{video?.title}</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
					{/* Sync Status Indicator */}
					{!syncStatusLoading && syncStatus && (
						<div>
							{syncStatus.isSynced ? (
								<Badge variant="accent">
									<CheckCircle className="size-4" />
									Synced
								</Badge>
							) : (
								<div className="flex items-center gap-2">
									<Badge variant="destructive">
										<CloudOff className="size-4" />
										Not Synced
									</Badge>
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
			</DashboardHeader>

			<section className="mb-6">
				{videoLoading ? (
					<p className="text-muted-foreground">Loading video details...</p>
				) : video ? (
					<VideoEditor video={video} videoId={videoId} libraryId={libraryId} />
				) : (
					<p>Video not found</p>
				)}
			</section>
		</>
	);
}
