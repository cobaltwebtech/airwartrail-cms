import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Library, Plus, Settings, Star, Upload } from 'lucide-react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Badge } from '@/components/ui/badge';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
} from '@/components/ui/breadcrumb';
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

export const Route = createFileRoute('/_dashboard/libraries')({
	beforeLoad: async ({ location }) => {
		// Require authentication for the home page
		const session = await requireAuth(location);
		return { session };
	},
	loader: async ({ context: { queryClient } }) => {
		// Prefetch libraries on navigation
		await queryClient.ensureQueryData(trpc.mux.listLibraries.queryOptions());
	},
	component: LibrariesPage,
});

function LibrariesPage() {
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
				<div className="flex justify-between items-center gap-4">
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink href="/">&larr; Back to Home</BreadcrumbLink>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
					<Button asChild>
						<Link to="/upload">
							<Upload />
							Upload Video
						</Link>
					</Button>
				</div>
			</DashboardHeader>
			<div className="space-y-6">
				{error && (
					<div className="text-destructive rounded-md bg-destructive/10 p-4">
						Error loading libraries: {error.message}
					</div>
				)}

				{isLoading ? (
					<LibrariesSkeleton />
				) : libraries && libraries.length > 0 ? (
					<div className="grid gap-6 md:grid-cols-2">
						{libraries.map((library) => (
							<Link
								key={library.id}
								to="/library/$libraryId/videos"
								params={{ libraryId: library.id }}
							>
								<Card className="hover:bg-secondary transition-colors h-full">
									<CardHeader>
										<div className="flex items-start justify-between">
											<Library className="text-primary size-10" />
											<div className="flex items-center gap-4">
												{library.isDefault && (
													<Badge variant="secondary">
														<Star className="size-3 fill-primary" />
														Default
													</Badge>
												)}
												<Button asChild size="icon">
													<Link
														to="/library/edit-library/$libraryId"
														params={{ libraryId: library.id }}
														onClick={(e) => e.stopPropagation()}
													>
														<Settings className="size-5" />
														<span className="sr-only">Settings</span>
													</Link>
												</Button>
											</div>
										</div>
										<CardTitle>{library.name}</CardTitle>
									</CardHeader>
									<CardContent className="space-y-3">
										{library.description && (
											<CardDescription className="line-clamp-2">
												{library.description}
											</CardDescription>
										)}
										<div className="text-muted-foreground flex flex-wrap gap-2 text-xs">
											<Badge variant="outline" className="capitalize">
												{library.defaultPlaybackPolicy} Policy
											</Badge>
											<Badge variant="outline" className="capitalize">
												{library.defaultVideoQuality} Quality
											</Badge>
										</div>
									</CardContent>
								</Card>
							</Link>
						))}
					</div>
				) : (
					<EmptyLibraries />
				)}
			</div>
		</>
	);
}

function LibrariesSkeleton() {
	return (
		<div className="grid gap-6 md:grid-cols-2">
			{[1, 2].map((i) => (
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
					<Link to="/library/create-library">
						<Plus className="mr-2 size-4" />
						Create Library
					</Link>
				</Button>
			</CardContent>
		</Card>
	);
}
