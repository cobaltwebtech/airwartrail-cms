import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CirclePlus } from 'lucide-react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { PlaylistList } from '@/components/playlist/PlaylistList';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute(
	'/_dashboard/library/$libraryId/playlists',
)({
	component: PlaylistsIndexPage,
	loader: async ({ context: { queryClient }, params }) => {
		const { libraryId } = params;

		// Guard against missing libraryId
		if (!libraryId) {
			return { libraryId };
		}

		// Prefetch playlists from database
		await queryClient.ensureQueryData(
			trpc.mux.listPlaylists.queryOptions({ libraryId }),
		);
		// Also prefetch library info
		await queryClient.ensureQueryData(
			trpc.mux.getLibrary.queryOptions({ libraryId }),
		);
		return { libraryId };
	},
});

function PlaylistsIndexPage() {
	const { libraryId } = Route.useParams();

	const {
		data: playlists,
		isLoading,
		error,
	} = useQuery(trpc.mux.listPlaylists.queryOptions({ libraryId }));

	const { data: library } = useQuery(
		trpc.mux.getLibrary.queryOptions({ libraryId }),
	);

	if (error) {
		return (
			<div className="text-destructive">
				Error loading playlists: {error.message}
			</div>
		);
	}

	return (
		<>
			<DashboardHeader
				heading={library?.name ? `${library.name} - Playlists` : 'Playlists'}
				text={
					library?.description ||
					'Organize your videos into playlists for your streaming app.'
				}
			>
				<div className="flex justify-between items-center">
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink href="/">
									&larr; Back to Libraries
								</BreadcrumbLink>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
					<Button asChild variant="accent">
						<Link
							to="/library/$libraryId/create-playlist"
							params={{ libraryId }}
						>
							<CirclePlus />
							New Playlist
						</Link>
					</Button>
				</div>
			</DashboardHeader>

			<section className="my-4">
				{isLoading ? (
					<div className="text-muted-foreground">Loading playlists...</div>
				) : (
					<PlaylistList playlists={playlists} libraryId={libraryId} />
				)}
			</section>
		</>
	);
}
