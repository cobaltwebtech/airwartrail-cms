import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { FolderPlus, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DashboardHeader } from '@/components/DashboardHeader';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_dashboard/images/albums/create-album')({
	component: CreateAlbumPage,
});

function CreateAlbumPage() {
	const navigate = useNavigate();

	// Form state
	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [description, setDescription] = useState('');
	const [slugError, setSlugError] = useState<string | null>(null);

	// Create album mutation
	const createAlbumMutation = useMutation(
		trpc.cfImages.albums.createAlbum.mutationOptions({
			onSuccess: (album) => {
				toast.success('Album created successfully', {
					description: 'Redirecting to album editor...',
				});
				navigate({
					to: '/images/albums/$albumId',
					params: { albumId: album.id },
				});
			},
			onError: (error) => {
				if (
					error.data?.code === 'CONFLICT' ||
					error.message.toLowerCase().includes('slug')
				) {
					setSlugError(
						'An album with this slug already exists. Please choose a different slug.',
					);
					toast.error('Slug already exists', {
						description: 'Please choose a different URL slug.',
					});
				} else {
					toast.error('Failed to create album', {
						description: error.message || 'An unexpected error occurred',
					});
				}
			},
		}),
	);

	// Auto-generate slug from title
	const generateSlug = (value: string) => {
		return value
			.toLowerCase()
			.trim()
			.replace(/[^\w\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-');
	};

	const handleTitleChange = (value: string) => {
		setTitle(value);
		if (!slug || slug === generateSlug(title)) {
			setSlug(generateSlug(value));
		}
	};

	const handleSubmit = (e: React.SubmitEvent) => {
		e.preventDefault();

		if (!title.trim()) {
			toast.error('Title is required');
			return;
		}

		if (!slug.trim()) {
			toast.error('Slug is required');
			return;
		}

		createAlbumMutation.mutate({
			title: title.trim(),
			slug: slug.trim(),
			description: description.trim() || undefined,
		});
	};

	const isSubmitting = createAlbumMutation.isPending;

	return (
		<>
			<DashboardHeader
				heading="Create Album"
				text="Create a new album to organize your images."
			>
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink asChild>
								<Link to="/images/albums">&larr; Back to Albums</Link>
							</BreadcrumbLink>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</DashboardHeader>

			<div className="mx-auto w-full max-w-2xl p-4 lg:p-6">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FolderPlus className="size-5" />
							New Album
						</CardTitle>
						<CardDescription>
							Enter a title and optional description. You'll be redirected to
							the album editor to add images and configure additional settings.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-6">
							<div className="space-y-2">
								<Label htmlFor="title">Title *</Label>
								<Input
									id="title"
									type="text"
									placeholder="Enter album title"
									value={title}
									onChange={(e) => handleTitleChange(e.target.value)}
									disabled={isSubmitting}
									required
								/>
								<p className="text-muted-foreground text-sm">
									The name of your album.
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="slug">URL Slug *</Label>
								<Input
									id="slug"
									type="text"
									placeholder="enter-url-slug"
									value={slug}
									onChange={(e) => {
										setSlug(e.target.value);
										if (slugError) setSlugError(null);
									}}
									disabled={isSubmitting}
									required
									aria-invalid={!!slugError}
								/>
								{slugError ? (
									<p className="text-destructive text-sm">{slugError}</p>
								) : (
									<p className="text-muted-foreground text-sm">
										The URL-friendly version of the title. Auto-generated from
										the title but can be customized.
									</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="description">Description</Label>
								<Textarea
									id="description"
									placeholder="Optional description for this album"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									disabled={isSubmitting}
									rows={3}
								/>
								<p className="text-muted-foreground text-sm">
									A brief description of the album's contents. Max 1000
									characters.
								</p>
							</div>

							<div className="flex gap-3 pt-4">
								<Button type="submit" disabled={isSubmitting}>
									{isSubmitting ? (
										<>
											<Loader2 className="animate-spin" />
											Creating...
										</>
									) : (
										<>
											<FolderPlus />
											Create & Continue Editing
										</>
									)}
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => navigate({ to: '/images/albums' })}
									disabled={isSubmitting}
								>
									Cancel
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			</div>
		</>
	);
}
