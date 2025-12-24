import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import CollectionCreate from '@/components/collections/CollectionCreate';
import { CollectionsList } from '@/components/collections/CollectionsList';
import { DashboardHeader } from '@/components/DashboardHeader';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_dashboard/collections/')({
	component: CollectionsPage,
	loader: async ({ context: { queryClient } }) => {
		// Prefetch collections on navigation
		await queryClient.ensureQueryData(trpc.bunny.getCollections.queryOptions());
	},
});

function CollectionsPage() {
	const {
		data: collections,
		isLoading,
		error,
	} = useQuery(trpc.bunny.getCollections.queryOptions());

	if (error) {
		return (
			<div className="text-destructive">
				Error loading collections: {error.message}
			</div>
		);
	}

	return (
		<>
			<DashboardHeader
				heading="Collections"
				text="Manage your video collections."
			/>
			<CollectionCreate />
			<div className="grid gap-4 py-4">
				{isLoading ? (
					<div className="text-muted-foreground">Loading collections...</div>
				) : (
					<CollectionsList collections={collections} />
				)}
			</div>
		</>
	);
}
