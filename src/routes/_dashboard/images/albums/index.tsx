import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { CirclePlus } from 'lucide-react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { AlbumList } from '@/components/images/AlbumList';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';

// Search params for pagination and filtering
type AlbumsSearchParams = {
	page?: number;
	status?: 'draft' | 'published' | 'archived';
};

export const Route = createFileRoute('/_dashboard/images/albums/')({
	component: AlbumsPage,
	validateSearch: (search: Record<string, unknown>): AlbumsSearchParams => {
		return {
			page: Number(search?.page) || 1,
			status: ['draft', 'published', 'archived'].includes(
				search?.status as string,
			)
				? (search.status as 'draft' | 'published' | 'archived')
				: undefined,
		};
	},
	loaderDeps: ({ search: { page, status } }) => ({ page, status }),
	loader: async ({ context: { queryClient }, deps: { page, status } }) => {
		await queryClient.ensureQueryData(
			trpc.cfImages.albums.listAlbums.queryOptions({
				limit: 25,
				page: page || 1,
				sortOrder: 'desc',
				status,
			}),
		);
		return { page };
	},
});

function AlbumsPage() {
	const { page, status } = useSearch({ from: '/_dashboard/images/albums/' });
	const currentPage = page || 1;
	const navigate = Route.useNavigate();

	// Fetch albums with pagination
	const {
		data: albumsData,
		isLoading,
		error,
	} = useQuery({
		...trpc.cfImages.albums.listAlbums.queryOptions({
			limit: 25,
			page: currentPage,
			sortOrder: 'desc',
			status,
		}),
	});

	const handlePageChange = (newPage: number) => {
		navigate({
			search: (prev) => ({ ...prev, page: newPage }),
		});
	};

	if (error) {
		return (
			<div className="text-destructive">
				Error loading albums: {error.message}
			</div>
		);
	}

	return (
		<>
			<DashboardHeader heading="Albums">
				<div className="flex justify-between items-center">
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink asChild>
									<Link to="/images">&larr; Back to All Images</Link>
								</BreadcrumbLink>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
					<Button asChild>
						<Link to="/images/albums/create-album">
							<CirclePlus />
							Create Album
						</Link>
					</Button>
				</div>
			</DashboardHeader>

			<section className="my-4">
				{isLoading ? (
					<div className="text-muted-foreground">Loading albums...</div>
				) : (
					<AlbumList
						albums={albumsData?.albums}
						onPageChange={handlePageChange}
						currentPage={currentPage}
						totalPages={albumsData?.pagination.totalPages || 1}
						total={albumsData?.pagination.total || 0}
					/>
				)}
			</section>
		</>
	);
}
