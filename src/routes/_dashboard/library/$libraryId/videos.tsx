import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { RefreshCw, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { VideoList } from '@/components/videos/VideoList';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_dashboard/library/$libraryId/videos')({
	component: VideosPage,
	loader: async ({ context: { queryClient }, params }) => {
		const { libraryId } = params;
		// Prefetch videos on the server/during navigation
		await queryClient.ensureQueryData(
			trpc.mux.listAssets.queryOptions({ libraryId }),
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

	const {
		data: videos,
		isLoading,
		error,
	} = useQuery(trpc.mux.listAssets.queryOptions({ libraryId }));

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
					// Refresh the video list
					queryClient.invalidateQueries({
						queryKey: trpc.mux.listAssets.queryKey({ libraryId }),
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
				<div className="flex gap-2">
					<Button asChild size="sm">
						<Link
							to={`/library/$libraryId/edit-library`}
							params={{ libraryId }}
						>
							<Settings className="mr-2 size-4" />
							Edit Library
						</Link>
					</Button>
					<Button
						variant="secondary"
						size="sm"
						onClick={handleSync}
						disabled={syncMutation.isPending}
					>
						<RefreshCw
							className={`mr-2 size-4 ${syncMutation.isPending ? 'animate-spin' : ''}`}
						/>
						{syncMutation.isPending ? 'Syncing...' : 'Sync from Mux'}
					</Button>
				</div>
			</DashboardHeader>
			<div className="px-4 lg:px-6 mb-4">
				<Link
					to="/"
					className="text-sm text-muted-foreground hover:text-primary transition-colors"
				>
					← Back to Libraries
				</Link>
			</div>
			<div className="grid gap-4">
				{isLoading ? (
					<div className="text-muted-foreground">Loading videos...</div>
				) : (
					<VideoList videos={videos} libraryId={libraryId} />
				)}
			</div>
		</>
	);
}
