import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import VideoEditor from '@/components/video-editor/VideoEditor';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_dashboard/edit-video/$videoId')({
	component: VideoEditorPage,
	loader: async ({ context: { queryClient }, params }) => {
		// Prefetch video and collections
		await Promise.all([
			queryClient.ensureQueryData(
				trpc.bunny.getVideo.queryOptions({ videoId: params.videoId }),
			),
			queryClient.ensureQueryData(trpc.bunny.getCollections.queryOptions()),
		]);
		return { videoId: params.videoId };
	},
});

function VideoEditorPage() {
	const { videoId } = Route.useParams();

	const {
		data: video,
		isLoading: videoLoading,
		error: videoError,
	} = useQuery(trpc.bunny.getVideo.queryOptions({ videoId }));

	const { data: collections, isLoading: collectionsLoading } = useQuery(
		trpc.bunny.getCollections.queryOptions(),
	);

	if (videoError) {
		return (
			<div className="text-destructive">
				Error loading video: {videoError.message}
			</div>
		);
	}

	const isLoading = videoLoading || collectionsLoading;

	return (
		<>
			<Button asChild variant="link">
				<Link to="/videos">&larr; Back to Videos</Link>
			</Button>
			<DashboardHeader heading="Video Editor" />
			{isLoading ? (
				<div className="text-muted-foreground">Loading video details...</div>
			) : video ? (
				<VideoEditor
					video={video}
					videoId={videoId}
					collections={collections || []}
				/>
			) : (
				<p>Video not found</p>
			)}
		</>
	);
}
