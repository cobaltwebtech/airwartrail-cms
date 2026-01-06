import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Library, Plus, Settings, Upload } from 'lucide-react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { requireAuth } from '@/lib/auth-check';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/')({
	beforeLoad: async ({ location }) => {
		// Require authentication for the home page
		const session = await requireAuth(location);
		return { session };
	},
	loader: async ({ context: { queryClient } }) => {
		// Prefetch libraries on navigation
		await queryClient.ensureQueryData(trpc.mux.listLibraries.queryOptions());
	},
	component: IndexPage,
});

function IndexPage() {
	const {
		data: libraries,
		isLoading,
		error,
	} = useQuery(trpc.mux.listLibraries.queryOptions());

	return (
		<>
			<DashboardHeader
				heading="Video Libraries"
				text="Select a video library to manage your content."
			>
				<div className="flex gap-2">
					<Button variant="outline" asChild>
						<Link to="/upload">
							<Upload className="mr-2 size-4" />
							Upload Video
						</Link>
					</Button>
					<Button asChild>
						<Link to="/library/new">
							<Plus className="mr-2 size-4" />
							Create Library
						</Link>
					</Button>
				</div>
			</DashboardHeader>
			<main className="p-4 lg:p-6 space-y-6">
				{error && (
					<div className="text-destructive rounded-md bg-destructive/10 p-4">
						Error loading libraries: {error.message}
					</div>
				)}

				{isLoading ? (
					<LibrariesSkeleton />
				) : libraries && libraries.length > 0 ? (
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{libraries.map((library) => (
							<Card key={library.id} className="group h-full">
								<CardHeader>
									<div className="flex items-start justify-between">
										<Library className="text-primary size-10" />
										<div className="flex items-center gap-2">
											{library.isDefault && (
												<span className="bg-primary/10 text-primary rounded-full px-2 py-1 text-xs font-medium">
													Default
												</span>
											)}
											<Link
												to="/library/$libraryId/edit-library"
												params={{ libraryId: library.id }}
												onClick={(e) => e.stopPropagation()}
												className="text-muted-foreground hover:text-primary rounded p-1 transition-colors"
											>
												<Settings className="size-4" />
												<span className="sr-only">Settings</span>
											</Link>
										</div>
									</div>
									<Link
										to="/library/$libraryId/videos"
										params={{ libraryId: library.id }}
										className="block"
									>
										<CardTitle className="group-hover:text-primary transition-colors">
											{library.name}
										</CardTitle>
									</Link>
								</CardHeader>
								<Link
									to="/library/$libraryId/videos"
									params={{ libraryId: library.id }}
									className="block"
								>
									<CardContent className="space-y-3">
										{library.description && (
											<CardDescription className="line-clamp-2">
												{library.description}
											</CardDescription>
										)}
										<div className="text-muted-foreground flex flex-wrap gap-2 text-xs">
											<span className="bg-muted rounded px-2 py-1">
												{library.defaultPlaybackPolicy} playback
											</span>
											<span className="bg-muted rounded px-2 py-1">
												{library.defaultVideoQuality} quality
											</span>
										</div>
									</CardContent>
								</Link>
							</Card>
						))}
					</div>
				) : (
					<EmptyLibraries />
				)}
			</main>
		</>
	);
}

function LibrariesSkeleton() {
	return (
		<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			{[1, 2, 3].map((i) => (
				<Card key={i} className="h-full">
					<CardHeader>
						<Skeleton className="size-10 rounded" />
						<Skeleton className="mt-4 h-6 w-3/4" />
					</CardHeader>
					<CardContent className="space-y-3">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-2/3" />
						<div className="flex gap-2">
							<Skeleton className="h-6 w-24" />
							<Skeleton className="h-6 w-20" />
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

function EmptyLibraries() {
	return (
		<Card className="border-dashed">
			<CardContent className="flex flex-col items-center justify-center py-12 text-center">
				<Library className="text-muted-foreground mb-4 size-12" />
				<h3 className="text-lg font-semibold">No Video Libraries</h3>
				<p className="text-muted-foreground mt-2 max-w-sm">
					Get started by creating your first video library to organize and
					manage your video content.
				</p>
				<Button className="mt-6" asChild>
					<Link to="/library/new">
						<Plus className="mr-2 size-4" />
						Create Library
					</Link>
				</Button>
			</CardContent>
		</Card>
	);
}
