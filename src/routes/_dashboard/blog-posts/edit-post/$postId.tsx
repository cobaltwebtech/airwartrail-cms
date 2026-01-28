import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import { FileText, Loader2, Save, Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import FeaturedImage from '@/components/blog/FeaturedImage';
import { TiptapEditor } from '@/components/blog/TiptapEditor';
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute(
	'/_dashboard/blog-posts/edit-post/$postId',
)({
	loader: async ({ context: { queryClient }, params: { postId } }) => {
		if (!postId) {
			return { postId };
		}
		await queryClient.ensureQueryData(
			trpc.blog.get.queryOptions({ id: postId }),
		);
	},
	component: EditPostPage,
});

type PublishStatus = 'draft' | 'published' | 'scheduled' | 'archived';

function EditPostPage() {
	const { postId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const {
		data: post,
		isLoading,
		error,
	} = useQuery(trpc.blog.get.queryOptions({ id: postId }));

	// Form state
	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [slugError, setSlugError] = useState<string | null>(null);
	const [shortDescription, setShortDescription] = useState('');
	const [postContent, setPostContent] = useState<unknown>(null);
	const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);
	const [featuredImageAlt, setFeaturedImageAlt] = useState<string | null>(null);
	const [publishStatus, setPublishStatus] = useState<PublishStatus>('draft');
	const [isFeatured, setIsFeatured] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	// Initialize form state when data loads
	useEffect(() => {
		if (post) {
			setTitle(post.title || '');
			setSlug(post.slug || '');
			setShortDescription(post.shortDescription || '');
			setPostContent(post.postContent);
			setFeaturedImageUrl(post.featuredImageUrl);
			setFeaturedImageAlt(post.featuredImageAlt);
			setPublishStatus(post.publishStatus);
			setIsFeatured(post.isFeatured);
		}
	}, [post]);

	// Update mutation
	const updateMutation = useMutation(
		trpc.blog.update.mutationOptions({
			onSuccess: () => {
				toast.success('Post saved successfully');
				queryClient.invalidateQueries({
					queryKey: trpc.blog.get.queryKey({ id: postId }),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.blog.list.queryKey(),
				});
			},
			onError: (error) => {
				if (
					error.data?.code === 'CONFLICT' ||
					error.message.toLowerCase().includes('slug')
				) {
					setSlugError(
						'A post with this slug already exists. Please choose a different slug.',
					);
					toast.error('Slug already exists', {
						description: 'Please choose a different URL slug.',
					});
				} else {
					toast.error('Failed to save post', {
						description: error.message || 'An unexpected error occurred',
					});
				}
			},
		}),
	);

	// Publish mutation
	const publishMutation = useMutation(
		trpc.blog.publish.mutationOptions({
			onSuccess: () => {
				toast.success('Post published successfully');
				queryClient.invalidateQueries({
					queryKey: trpc.blog.get.queryKey({ id: postId }),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.blog.list.queryKey(),
				});
			},
			onError: (error) => {
				toast.error('Failed to publish post', {
					description: error.message,
				});
			},
		}),
	);

	// Unpublish mutation
	const unpublishMutation = useMutation(
		trpc.blog.unpublish.mutationOptions({
			onSuccess: () => {
				toast.success('Post unpublished');
				queryClient.invalidateQueries({
					queryKey: trpc.blog.get.queryKey({ id: postId }),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.blog.list.queryKey(),
				});
			},
			onError: (error) => {
				toast.error('Failed to unpublish post', {
					description: error.message,
				});
			},
		}),
	);

	// Delete mutation
	const deleteMutation = useMutation(
		trpc.blog.delete.mutationOptions({
			onSuccess: () => {
				toast.success('Post deleted');
				queryClient.invalidateQueries({
					queryKey: trpc.blog.list.queryKey(),
				});
				navigate({ to: '/blog-posts' });
			},
			onError: (error) => {
				toast.error('Failed to delete post', {
					description: error.message,
				});
			},
		}),
	);

	// Toggle featured mutation
	const toggleFeaturedMutation = useMutation(
		trpc.blog.toggleFeatured.mutationOptions({
			onSuccess: (result) => {
				toast.success(
					result.isFeatured
						? 'Post marked as featured'
						: 'Post removed from featured',
				);
				setIsFeatured(result.isFeatured);
				queryClient.invalidateQueries({
					queryKey: trpc.blog.get.queryKey({ id: postId }),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.blog.list.queryKey(),
				});
			},
			onError: (error) => {
				toast.error('Failed to update featured status', {
					description: error.message,
				});
			},
		}),
	);

	const handleSave = () => {
		if (!title.trim()) {
			toast.error('Title is required');
			return;
		}
		if (!slug.trim()) {
			toast.error('Slug is required');
			return;
		}

		updateMutation.mutate({
			id: postId,
			title: title.trim(),
			slug: slug.trim(),
			shortDescription: shortDescription.trim() || null,
			postContent,
			featuredImageAlt: featuredImageAlt?.trim() || null,
			publishStatus,
			isFeatured,
		});
	};

	const isSaving = updateMutation.isPending;
	const isPublishing = publishMutation.isPending;
	const isUnpublishing = unpublishMutation.isPending;
	const isDeleting = deleteMutation.isPending;
	const isTogglingFeatured = toggleFeaturedMutation.isPending;
	const isAnyMutationPending =
		isSaving ||
		isPublishing ||
		isUnpublishing ||
		isDeleting ||
		isTogglingFeatured;

	if (isLoading) {
		return <EditPostSkeleton />;
	}

	if (error || !post) {
		return (
			<div className="text-destructive rounded-md bg-destructive/10 p-4">
				{error?.message || 'Post not found'}
			</div>
		);
	}

	const getStatusBadge = (status: PublishStatus) => {
		switch (status) {
			case 'published':
				return <Badge variant="default">Published</Badge>;
			case 'draft':
				return <Badge variant="secondary">Draft</Badge>;
			case 'scheduled':
				return <Badge variant="outline">Scheduled</Badge>;
			case 'archived':
				return <Badge variant="destructive">Archived</Badge>;
			default:
				return null;
		}
	};

	return (
		<>
			<DashboardHeader heading="Edit Blog Post" text={post.title}>
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink asChild>
								<Link to="/blog-posts">&larr; Back to Blog Posts</Link>
							</BreadcrumbLink>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</DashboardHeader>

			<div className="space-y-6">
				{/* Action bar */}
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div className="flex items-center gap-2">
						{getStatusBadge(post.publishStatus)}
						{post.isFeatured && (
							<Badge>
								<Star className="size-3 fill-background" />
								Featured
							</Badge>
						)}
					</div>
					<div>
						<Button
							onClick={handleSave}
							disabled={isAnyMutationPending}
							size="sm"
						>
							{isSaving ? <Loader2 className="animate-spin" /> : <Save />}
							Save Changes
						</Button>
					</div>
				</div>

				<div className="grid gap-6 lg:grid-cols-3">
					{/* Main content area */}
					<div className="lg:col-span-2 space-y-6">
						{/* Title and Slug */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<FileText className="size-5" />
									Post Details
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="title">Title *</Label>
									<Input
										id="title"
										value={title}
										onChange={(e) => setTitle(e.target.value)}
										placeholder="Enter post title"
										disabled={isAnyMutationPending}
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="slug">URL Slug *</Label>
									<Input
										id="slug"
										value={slug}
										onChange={(e) => {
											setSlug(e.target.value);
											if (slugError) setSlugError(null);
										}}
										placeholder="enter-url-slug"
										disabled={isAnyMutationPending}
										aria-invalid={!!slugError}
									/>
									{slugError ? (
										<p className="text-destructive text-sm">{slugError}</p>
									) : (
										<p className="text-muted-foreground text-sm">
											The URL-friendly version of the title.
										</p>
									)}
								</div>

								<div className="space-y-2">
									<Label htmlFor="shortDescription">Short Description</Label>
									<Textarea
										id="shortDescription"
										value={shortDescription}
										onChange={(e) => setShortDescription(e.target.value)}
										placeholder="A brief summary of the post for previews and SEO"
										rows={3}
										disabled={isAnyMutationPending}
										maxLength={100}
									/>
									<p className="text-muted-foreground text-sm">
										{shortDescription.length}/100 characters
									</p>
								</div>
							</CardContent>
						</Card>

						{/* Content Editor */}
						<Card>
							<CardHeader>
								<CardTitle>Content</CardTitle>
								<CardDescription>
									Write your blog post content using the rich text editor.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<TiptapEditor
									content={postContent}
									onChange={setPostContent}
									disabled={isAnyMutationPending}
								/>
							</CardContent>
						</Card>
					</div>

					{/* Sidebar */}
					<div className="space-y-6">
						{/* Status and Settings */}
						<Card>
							<CardHeader>
								<CardTitle>Status & Settings</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="publishStatus">Publish Status</Label>
									<Select
										value={publishStatus}
										onValueChange={(value) =>
											setPublishStatus(value as PublishStatus)
										}
										disabled={isAnyMutationPending}
									>
										<SelectTrigger id="publishStatus">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="draft">Draft</SelectItem>
											<SelectItem value="published">Published</SelectItem>
											<SelectItem value="scheduled">Scheduled</SelectItem>
											<SelectItem value="archived">Archived</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="flex items-center justify-between">
									<div className="space-y-0.5">
										<Label>Featured Post</Label>
										<p className="text-muted-foreground text-sm">
											Display prominently on the homepage
										</p>
									</div>
									<Switch
										checked={isFeatured}
										onCheckedChange={setIsFeatured}
										disabled={isAnyMutationPending}
									/>
								</div>
							</CardContent>
						</Card>

						{/* Featured Image */}
						<FeaturedImage
							postId={postId}
							currentImageUrl={featuredImageUrl}
							currentImageAlt={featuredImageAlt}
							onImageUploaded={(url) => setFeaturedImageUrl(url)}
							onImageDeleted={() => setFeaturedImageUrl(null)}
							onAltTextChange={(alt) => setFeaturedImageAlt(alt)}
							disabled={isAnyMutationPending}
						/>

						{/* Post Info */}
						<Card>
							<CardHeader>
								<CardTitle>Post Information</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Author</span>
									<span>{post.author}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Created</span>
									<span>{format(new Date(post.createdAt), 'PPP')}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Updated</span>
									<span>{format(new Date(post.updatedAt), 'PPP')}</span>
								</div>
								{post.publishedAt && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Published</span>
										<span>{format(new Date(post.publishedAt), 'PPP')}</span>
									</div>
								)}
							</CardContent>
						</Card>

						{/* Danger Zone */}
						<Card className="border-destructive/50">
							<CardHeader>
								<CardTitle className="text-destructive">Danger Zone</CardTitle>
							</CardHeader>
							<CardContent>
								<Button
									variant="destructive"
									onClick={() => setIsDeleteDialogOpen(true)}
									disabled={isAnyMutationPending}
									className="w-full"
								>
									{isDeleting ? (
										<Loader2 className="animate-spin" />
									) : (
										<Trash2 />
									)}
									Delete Post
								</Button>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>

			{/* Delete Confirmation Dialog */}
			<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Post</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this post? This action cannot be
							undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsDeleteDialogOpen(false)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() => {
								deleteMutation.mutate({ id: postId });
								setIsDeleteDialogOpen(false);
							}}
							disabled={isDeleting}
						>
							{isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function EditPostSkeleton() {
	return (
		<div className="space-y-6">
			<Skeleton className="h-12 w-64" />
			<div className="flex justify-between">
				<Skeleton className="h-8 w-24" />
				<div className="flex gap-2">
					<Skeleton className="h-9 w-24" />
					<Skeleton className="h-9 w-32" />
				</div>
			</div>
			<div className="grid gap-6 lg:grid-cols-3">
				<div className="lg:col-span-2 space-y-6">
					<Skeleton className="h-48" />
					<Skeleton className="h-96" />
				</div>
				<div className="space-y-6">
					<Skeleton className="h-48" />
					<Skeleton className="h-48" />
					<Skeleton className="h-32" />
				</div>
			</div>
		</div>
	);
}
