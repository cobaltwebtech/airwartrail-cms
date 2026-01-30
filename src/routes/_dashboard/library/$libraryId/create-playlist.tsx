import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ListVideo, Loader2, Settings } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DashboardHeader } from '@/components/DashboardHeader';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
	PLAYLIST_CATEGORY_OPTIONS,
	type PlaylistCategory,
} from '@/lib/constants';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute(
	'/_dashboard/library/$libraryId/create-playlist',
)({
	component: CreatePlaylistPage,
});

function CreatePlaylistPage() {
	const { libraryId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	// Fetch library details
	const { data: library } = useQuery(
		trpc.mux.getLibrary.queryOptions({ libraryId }, { enabled: !!libraryId }),
	);

	// Form state
	const [name, setName] = useState('');
	const [slug, setSlug] = useState('');
	const [description, setDescription] = useState('');
	const [category, setCategory] = useState<PlaylistCategory>('featured');

	// Auto-generate slug from name
	const handleNameChange = (newName: string) => {
		setName(newName);
		// Only auto-generate slug if it hasn't been manually edited
		if (!slug || slug === generateSlug(name)) {
			setSlug(generateSlug(newName));
		}
	};

	const generateSlug = (text: string): string => {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	};

	// Create mutation
	const createMutation = useMutation({
		...trpc.mux.createPlaylist.mutationOptions(),
		onSuccess: (result) => {
			toast.success('Playlist created successfully');
			queryClient.invalidateQueries({
				queryKey: trpc.mux.listPlaylists.queryKey({ libraryId }),
			});
			navigate({
				to: '/library/$libraryId/playlist/$playlistId',
				params: { libraryId, playlistId: result.id },
			});
		},
		onError: (error) => {
			toast.error(`Failed to create playlist: ${error.message}`);
		},
	});

	const handleCreate = () => {
		if (!name) {
			toast.error('Please enter a playlist name');
			return;
		}

		if (!slug) {
			toast.error('Please enter a slug');
			return;
		}

		createMutation.mutate({
			libraryId,
			name,
			slug,
			description: description || undefined,
			category,
		});
	};

	const canCreate = name && slug;
	const libraryName = library?.name ?? 'Library';

	return (
		<>
			<DashboardHeader
				heading="Create Playlist"
				text="Create a new playlist to organize your videos."
			>
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink href="/">All Libraries</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbLink asChild>
								<Link to="/library/$libraryId/playlists" params={{ libraryId }}>
									{libraryName} Playlists
								</Link>
							</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>New Playlist</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</DashboardHeader>

			<section className="space-y-6">
				{/* General Settings */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Settings className="size-5" />
							General Settings
						</CardTitle>
						<CardDescription>
							Basic information about your playlist.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="name">
								Playlist Name <span className="text-destructive">*</span>
							</Label>
							<Input
								id="name"
								value={name}
								onChange={(e) => handleNameChange(e.target.value)}
								placeholder="My Awesome Playlist"
								required
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="slug">
								Slug <span className="text-destructive">*</span>
							</Label>
							<Input
								id="slug"
								value={slug}
								onChange={(e) => setSlug(e.target.value)}
								placeholder="my-awesome-playlist"
								required
							/>
							<p className="text-muted-foreground text-xs">
								URL-friendly identifier that is auto-generated from the name.
								Only modify this if you need a specific URL for the playlist.
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="description">Description</Label>
							<Textarea
								id="description"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Optional description for this playlist..."
								rows={3}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="type">Type</Label>
							<Select
								value={category}
								onValueChange={(value) =>
									setCategory(value as PlaylistCategory)
								}
							>
								<SelectTrigger id="type">
									<SelectValue placeholder="Select type" />
								</SelectTrigger>
								<SelectContent>
									{PLAYLIST_CATEGORY_OPTIONS.map((item) => (
										<SelectItem key={item.value} value={item.value}>
											{item.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<p className="text-muted-foreground text-xs">
								{
									PLAYLIST_CATEGORY_OPTIONS.find(
										(item) => item.value === category,
									)?.description
								}
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Actions */}
				<div className="flex justify-end gap-4">
					<Button variant="outline" asChild>
						<Link to="/library/$libraryId/playlists" params={{ libraryId }}>
							Cancel
						</Link>
					</Button>
					<Button
						onClick={handleCreate}
						disabled={!canCreate || createMutation.isPending}
					>
						{createMutation.isPending ? (
							<>
								<Loader2 className="mr-2 size-4 animate-spin" />
								Creating...
							</>
						) : (
							<>
								<ListVideo className="mr-2 size-4" />
								Create Playlist
							</>
						)}
					</Button>
				</div>
			</section>
		</>
	);
}
