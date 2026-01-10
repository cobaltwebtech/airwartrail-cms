import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { DashboardHeader } from '@/components/DashboardHeader';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import VideoEditor from '@/components/video-editor/VideoEditor';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute(
	'/_dashboard/library/$libraryId/edit-video/$videoId',
)({
	component: VideoEditorPage,
	loader: async ({ context: { queryClient }, params }) => {
		const { libraryId, videoId } = params;
		// Prefetch video details using internal database ID
		await queryClient.ensureQueryData(
			trpc.mux.getVideoById.queryOptions({ videoId, libraryId }),
		);
		return { videoId, libraryId };
	},
});

function VideoEditorPage() {
	const { videoId, libraryId } = Route.useParams();

	// Fetch video by internal database ID
	const {
		data: videoData,
		isLoading: videoLoading,
		error: videoError,
	} = useQuery(trpc.mux.getVideoById.queryOptions({ videoId, libraryId }));

	// Fetch view count from Mux Data API (using muxAssetId)
	const { data: viewCountData } = useQuery(
		trpc.mux.getAssetViewCount.queryOptions(
			{ muxAssetId: videoData?.muxAssetId ?? '', libraryId },
			{ enabled: !!videoData?.muxAssetId },
		),
	);

	// Fetch library details to get library name
	const { data: library } = useQuery(
		trpc.mux.getLibrary.queryOptions({ libraryId }, { enabled: !!libraryId }),
	);

	// Transform to VideoEditor video format
	const video = videoData
		? {
				title: videoData.title || 'Untitled',
				duration: videoData.duration || 0,
				statusText:
					videoData.status === 'ready'
						? 'Ready'
						: videoData.status === 'errored'
							? 'Error'
							: 'Processing',
				views: viewCountData?.views ?? videoData.views ?? 0,
				dateUploaded: videoData.createdAt || new Date().toISOString(),
				isPublished: videoData.isPublished,
				captions: videoData.captions?.map((cap) => ({
					label: cap.name || cap.language || 'Caption',
					srclang: cap.languageCode || 'en',
				})),
				resolutionTier: videoData.resolutionTier,
				aspectRatio: videoData.aspectRatio,
				videoQuality: videoData.videoQuality,
				maxStoredFrameRate: videoData.maxStoredFrameRate,
				maxWidth: videoData.maxWidth,
				maxHeight: videoData.maxHeight,
				id: videoData.id,
				muxAssetId: videoData.muxAssetId,
				muxPlaybackId: videoData.muxPlaybackId ?? undefined,
				muxEnvironmentId: videoData.muxEnvironmentId ?? undefined,
				createdAt: videoData.createdAt,
				updatedAt: videoData.updatedAt,
				viewCountSyncedAt: videoData.viewCountSyncedAt,
				libraryName: videoData.libraryName ?? library?.name,
				description: videoData.description ?? undefined,
				tags: videoData.tags ?? [],
				errorType: videoData.errorType ?? undefined,
				errorMessages: videoData.errorMessages ?? undefined,
				playbackPolicy: videoData.policy ?? undefined,
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
