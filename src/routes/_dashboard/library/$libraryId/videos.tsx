import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { RefreshCw, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardHeader } from '@/components/DashboardHeader';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { VideoList } from '@/components/videos/VideoList';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_dashboard/library/$libraryId/videos')({
	component: VideosPage,
	loader: async ({ context: { queryClient }, params }) => {
		const { libraryId } = params;
		// Prefetch videos from database on the server/during navigation
		await queryClient.ensureQueryData(
			trpc.mux.listVideosFromDatabase.queryOptions({ libraryId }),
		);
		// Also prefetch library info
		await queryClient.ensureQueryData(
			trpc.mux.getLibrary.queryOptions({ libraryId }),
		);
		return { libraryId };
	},
});

function VideosPage() {
	const { libraryId } = Route.useParams();
	const queryClient = useQueryClient();

	// Fetch videos from internal database (uses internal IDs)
	const {
		data: videos,
		isLoading,
		error,
	} = useQuery({
		...trpc.mux.listVideosFromDatabase.queryOptions({ libraryId }),
		// Poll every 5 seconds while any video is still processing
		refetchInterval: (query) => {
			const data = query.state.data;
			const hasProcessingVideos = data?.some(
				(video) => video.status === 'preparing',
			);
			return hasProcessingVideos ? 5000 : false;
		},
	});

	const { data: library } = useQuery(
		trpc.mux.getLibrary.queryOptions({ libraryId }),
	);

	// Sync mutation for importing videos from Mux
	const syncMutation = useMutation(
		trpc.mux.syncMuxAssets.mutationOptions({
			onSuccess: (result) => {
				if (result.synced > 0 || result.updated > 0) {
					const messages: string[] = [];
					if (result.synced > 0) {
						messages.push(
							`${result.synced} new video${result.synced > 1 ? 's' : ''} synced`,
						);
					}
					if (result.updated > 0) {
						messages.push(
							`${result.updated} existing video${result.updated > 1 ? 's' : ''} linked to Mux`,
						);
					}
					toast.success(messages.join(', '));
					// Refresh the video list from database
					queryClient.invalidateQueries({
						queryKey: trpc.mux.listVideosFromDatabase.queryKey({ libraryId }),
					});
				} else {
					toast.info('All videos are already synced');
				}
			},
			onError: (error) => {
				toast.error(`Sync failed: ${error.message}`);
			},
		}),
	);

	const handleSync = () => {
		syncMutation.mutate({ libraryId });
	};

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
				heading={library?.name ? `${library.name} - Videos` : 'Videos'}
				text={library?.description || 'Manage your streaming video library.'}
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
					<div className="flex gap-4">
						<Button asChild>
							<Link
								to="/library/edit-library/$libraryId"
								params={{ libraryId }}
							>
								<Settings />
								Edit Library
							</Link>
						</Button>
						<Button
							variant="secondary"
							onClick={handleSync}
							disabled={syncMutation.isPending}
						>
							<RefreshCw
								className={`${syncMutation.isPending ? 'animate-spin' : ''}`}
							/>
							{syncMutation.isPending ? 'Syncing...' : 'Sync from Mux'}
						</Button>
					</div>
				</div>
			</DashboardHeader>

			<section className="my-4">
				{isLoading ? (
					<div className="text-muted-foreground">Loading videos...</div>
				) : (
					<VideoList videos={videos} libraryId={libraryId} />
				)}
			</section>
		</>
	);
}
