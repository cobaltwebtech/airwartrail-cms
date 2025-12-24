import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { DashboardHeader } from '@/components/DashboardHeader';
import { VideoList } from '@/components/videos/VideoList';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_dashboard/collections/$collectionId')({
	component: CollectionDetailPage,
	loader: async ({ context: { queryClient }, params }) => {
		// Prefetch both collections and videos
		await Promise.all([
			queryClient.ensureQueryData(trpc.bunny.getCollections.queryOptions()),
			queryClient.ensureQueryData(trpc.bunny.getAllVideos.queryOptions()),
		]);
		return { collectionId: params.collectionId };
	},
});

function CollectionDetailPage() {
	const { collectionId } = Route.useParams();

	const { data: collections } = useQuery(
		trpc.bunny.getCollections.queryOptions(),
	);
	const { data: videos, isLoading } = useQuery(
		trpc.bunny.getAllVideos.queryOptions(),
	);

	const collection = collections?.find((col) => col.guid === collectionId);
	const collectionVideos = videos?.filter(
		(video) => video.collectionId === collectionId,
	);

	if (!collection) {
		return <div className="text-destructive">Collection not found</div>;
	}

	return (
		<>
			<DashboardHeader
				heading={collection.name}
				text="List of videos in collection."
			/>
			{isLoading ? (
				<div className="text-muted-foreground">Loading videos...</div>
			) : (
				<VideoList videos={collectionVideos} />
			)}
		</>
	);
}
