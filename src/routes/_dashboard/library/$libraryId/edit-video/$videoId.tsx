import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { TRPCClientError } from '@trpc/client';
import { useState } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { NotFound } from '@/components/NotFound';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import CaptionEditor from '@/components/video-editor/CaptionEditor';
import ChapterEditor from '@/components/video-editor/ChapterEditor';
import CustomThumbnail from '@/components/video-editor/CustomThumbnail';
import DescriptionEditor from '@/components/video-editor/DescriptionEditor';
import PlaybackPolicyEditor from '@/components/video-editor/PlaybackPolicyEditor';
import PublishStatus from '@/components/video-editor/PublishStatus';
import TagEditor from '@/components/video-editor/TagEditor';
import TitleEditor from '@/components/video-editor/TitleEditor';
import VideoData from '@/components/video-editor/VideoData';
import VideoInfo from '@/components/video-editor/VideoInfo';
import VideoPlayer from '@/components/video-editor/VideoPlayer';
import { getVideoStatusLabel, type VideoStatus } from '@/lib/constants';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute(
	'/_dashboard/library/$libraryId/edit-video/$videoId',
)({
	component: VideoEditorPage,
	notFoundComponent: NotFound,
	loader: async ({ context: { queryClient }, params }) => {
		const { libraryId, videoId } = params;
		try {
			// Prefetch video details using internal database ID
			const video = await queryClient.ensureQueryData(
				trpc.mux.getVideoById.queryOptions({ videoId, libraryId }),
			);
			// Throw notFound() to trigger the notFoundComponent instead of error boundary
			if (!video) {
				throw notFound();
			}
			return { videoId, libraryId };
		} catch (error) {
			// If the tRPC query throws NOT_FOUND, convert to router's notFound
			if (
				error instanceof TRPCClientError &&
				error.data?.code === 'NOT_FOUND'
			) {
				throw notFound();
			}
			throw error;
		}
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

	// Fetch video tags separately (tags are now in a dedicated table)
	const { data: videoTags } = useQuery(
		trpc.mux.getVideoTags.queryOptions(
			{ videoId, libraryId },
			{ enabled: !!videoId },
		),
	);

	// Fetch library details to get library name
	const { data: library } = useQuery(
		trpc.mux.getLibrary.queryOptions({ libraryId }, { enabled: !!libraryId }),
	);

	const [title, setTitle] = useState(videoData?.title || '');
	const [description, setDescription] = useState(videoData?.description || '');

	// Extract local variables from videoData
	const duration = videoData?.duration || 0;
	const dateUploaded = videoData?.createdAt || new Date().toISOString();
	const views = videoData?.views ?? 0;
	const statusText = getVideoStatusLabel(videoData?.status as VideoStatus);
	const captions =
		videoData?.captions?.map((cap) => ({
			label: cap.name || cap.language || 'Caption',
			srclang: cap.languageCode || 'en',
		})) || [];
	const resolutionTier = videoData?.resolutionTier ?? undefined;
	const aspectRatio = videoData?.aspectRatio ?? undefined;
	const videoQuality = videoData?.videoQuality ?? undefined;
	const maxStoredFrameRate = videoData?.maxStoredFrameRate ?? undefined;
	const maxWidth = videoData?.maxWidth ?? undefined;
	const maxHeight = videoData?.maxHeight ?? undefined;
	const internalId = videoData?.id || '';
	const muxAssetId = videoData?.muxAssetId || videoId;
	const muxPlaybackId = videoData?.muxPlaybackId || '';
	const muxEnvironmentId = videoData?.muxEnvironmentId || '';
	const createdAt = videoData?.createdAt;
	const updatedAt = videoData?.updatedAt;
	const viewCountSyncedAt = videoData?.viewCountSyncedAt ?? undefined;
	const errorCategory = videoData?.errorCategory ?? undefined;
	const errorMessages = videoData?.errorMessages ?? undefined;
	const playbackPolicy = videoData?.policy ?? undefined;
	const totalWatchTime = videoData?.totalWatchTimeMs ?? 0;
	// Tags are now fetched separately from the videoTags table
	const tagIds = videoTags?.map((t) => t.id) ?? [];
	const libraryName = videoData?.libraryName ?? library?.name;
	const isPublished = videoData?.isPublished;

	const handleTitleUpdate = (newTitle: string) => {
		setTitle(newTitle);
	};

	const handleDescriptionUpdate = (newDescription: string) => {
		setDescription(newDescription);
	};

	if (videoError) {
		return (
			<div className="text-destructive">
				Error loading video: {videoError.message}
			</div>
		);
	}

	const videoTitle = videoData?.title || 'Untitled';

	return (
		<>
			<DashboardHeader heading="Video Editor">
				<div className="flex justify-between items-center py-4">
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink href="/">Home</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbLink href="/libraries">All Libraries</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbLink asChild>
									<Link to="/library/$libraryId/videos" params={{ libraryId }}>
										{libraryName} Videos
									</Link>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>{videoTitle}</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
			</DashboardHeader>

			<section className="mb-6">
				{videoLoading ? (
					<p className="text-muted-foreground">Loading video details...</p>
				) : videoData ? (
					<div className="grid md:grid-cols-6 gap-4">
						<VideoInfo
							duration={duration}
							views={views}
							initialTitle={title}
							dateUploaded={dateUploaded}
							statusText={statusText}
							libraryName={libraryName}
							resolutionTier={resolutionTier}
							aspectRatio={aspectRatio}
							videoQuality={videoQuality}
							maxStoredFrameRate={maxStoredFrameRate}
							maxWidth={maxWidth}
							maxHeight={maxHeight}
							errorCategory={errorCategory}
							errorMessages={errorMessages}
							playbackPolicy={playbackPolicy}
						/>
						<TitleEditor
							videoId={videoId}
							libraryId={libraryId}
							initialTitle={title}
							onTitleUpdate={handleTitleUpdate}
						/>
						<VideoPlayer
							muxAssetId={muxAssetId}
							libraryId={libraryId}
							internalVideoId={internalId}
						/>
						<PublishStatus
							videoId={videoId}
							libraryId={libraryId}
							initialPublishStatus={isPublished}
						/>
						<TagEditor
							videoId={videoId}
							libraryId={libraryId}
							initialTagIds={tagIds}
						/>
						<DescriptionEditor
							videoId={videoId}
							libraryId={libraryId}
							initialDescription={description}
							onDescriptionUpdate={handleDescriptionUpdate}
						/>
						<CustomThumbnail videoId={videoId} libraryId={libraryId} />
						<CaptionEditor
							muxAssetId={muxAssetId}
							libraryId={libraryId}
							initialCaptions={captions}
						/>
						<PlaybackPolicyEditor
							videoId={videoId}
							libraryId={libraryId}
							initialPolicy={playbackPolicy}
						/>
						<ChapterEditor
							videoId={internalId}
							libraryId={libraryId}
							videoDuration={duration}
						/>
						<VideoData
							internalId={internalId}
							libraryId={libraryId}
							muxAssetId={muxAssetId}
							muxPlaybackId={muxPlaybackId}
							muxEnvironmentId={muxEnvironmentId}
							createdAt={createdAt}
							updatedAt={updatedAt}
							viewCountSyncedAt={viewCountSyncedAt}
							totalWatchTime={totalWatchTime}
						/>
					</div>
				) : (
					<p>Video not found</p>
				)}
			</section>
		</>
	);
}
