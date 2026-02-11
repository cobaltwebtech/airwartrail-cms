import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { ImagePlus, Upload } from 'lucide-react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { ImageList } from '@/components/images/ImageList';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';

// Search params for pagination
type ImagesSearchParams = {
	page?: number;
};

export const Route = createFileRoute('/_dashboard/images/')({
	component: ImagesPage,
	validateSearch: (search: Record<string, unknown>): ImagesSearchParams => {
		return {
			page: Number(search?.page) || 1,
		};
	},
	loaderDeps: ({ search: { page } }) => ({ page }),
	loader: async ({ context: { queryClient }, deps: { page } }) => {
		// Prefetch images from database
		await queryClient.ensureQueryData(
			trpc.cfImages.images.listImages.queryOptions({
				limit: 50,
				page: page || 1,
				sortOrder: 'desc',
			}),
		);
		return { page };
	},
});

function ImagesPage() {
	const { page } = useSearch({ from: '/_dashboard/images/' });
	const currentPage = page || 1;
	const navigate = Route.useNavigate();

	// Fetch images from database with pagination
	const {
		data: imagesData,
		isLoading,
		error,
	} = useQuery({
		...trpc.cfImages.images.listImages.queryOptions({
			limit: 50,
			page: currentPage,
			sortOrder: 'desc',
		}),
	});

	const handlePageChange = (newPage: number) => {
		navigate({
			search: { page: newPage },
		});
	};

	if (error) {
		return (
			<div className="text-destructive">
				Error loading images: {error.message}
			</div>
		);
	}

	return (
		<>
			<DashboardHeader heading="Images" text="Manage your image library">
				<div className="flex justify-end">
					<div className="flex gap-4">
						<Button asChild variant="secondary">
							<Link to="/images/albums">
								<ImagePlus />
								View Albums
							</Link>
						</Button>
						<Button asChild>
							<Link to="/images/upload">
								<Upload />
								Upload Images
							</Link>
						</Button>
					</div>
				</div>
			</DashboardHeader>

			<section className="my-4">
				{isLoading ? (
					<div className="text-muted-foreground">Loading images...</div>
				) : (
					<ImageList
						images={imagesData?.images}
						onPageChange={handlePageChange}
						currentPage={currentPage}
						totalPages={imagesData?.pagination.totalPages || 1}
						total={imagesData?.pagination.total || 0}
					/>
				)}
			</section>
		</>
	);
}
