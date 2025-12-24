import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { DashboardHeader } from '@/components/DashboardHeader';
import { VideoList } from '@/components/videos/VideoList';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_dashboard/videos/')({
	component: VideosPage,
	loader: async ({ context: { queryClient } }) => {
		// Prefetch videos on the server/during navigation
		await queryClient.ensureQueryData(trpc.bunny.getAllVideos.queryOptions());
	},
});

function VideosPage() {
	const {
		data: videos,
		isLoading,
		error,
	} = useQuery(trpc.bunny.getAllVideos.queryOptions());

	if (error) {
		return (
			<div className="text-destructive">
				Error loading videos: {error.message}
			</div>
		);
	}

	return (
		<>
			<DashboardHeader
				heading="Videos"
				text="Manage your streaming video library."
			/>
			<div className="grid gap-4">
				{isLoading ? (
					<div className="text-muted-foreground">Loading videos...</div>
				) : (
					<VideoList videos={videos} />
				)}
			</div>
		</>
	);
}
