import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { FileText, Loader2 } from 'lucide-react';
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
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_dashboard/blog-posts/create-post')({
	component: CreatePostPage,
});

function CreatePostPage() {
	const navigate = useNavigate();

	// Form state - only required fields
	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [slugError, setSlugError] = useState<string | null>(null);

	// Create post mutation
	const createPostMutation = useMutation(
		trpc.blog.create.mutationOptions({
			onSuccess: (post) => {
				toast.success('Post created successfully', {
					description: 'Redirecting to editor...',
				});
				// Navigate to the edit page
				navigate({
					to: '/blog-posts/edit-post/$postId',
					params: { postId: post.id },
				});
			},
			onError: (error) => {
				// Check if error is a slug conflict
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
					toast.error('Failed to create post', {
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
			.replace(/[^\w\s-]/g, '') // Remove special characters
			.replace(/\s+/g, '-') // Replace spaces with hyphens
			.replace(/-+/g, '-'); // Remove consecutive hyphens
	};

	const handleTitleChange = (value: string) => {
		setTitle(value);
		// Auto-generate slug if user hasn't manually edited it
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

		createPostMutation.mutate({
			title: title.trim(),
			slug: slug.trim(),
			publishStatus: 'draft',
		});
	};

	const isSubmitting = createPostMutation.isPending;

	return (
		<>
			<DashboardHeader
				heading="Create Blog Post"
				text="Start a new blog post and continue editing in the full editor."
			>
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

			<div className="w-full max-w-2xl mx-auto p-4 lg:p-6">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FileText className="size-5" />
							New Blog Post
						</CardTitle>
						<CardDescription>
							Enter a title and URL slug to create your post. You'll be
							redirected to the full editor to add content and configure
							additional settings.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-6">
							<div className="space-y-2">
								<Label htmlFor="title">Title *</Label>
								<Input
									id="title"
									type="text"
									placeholder="Enter post title"
									value={title}
									onChange={(e) => handleTitleChange(e.target.value)}
									disabled={isSubmitting}
									required
								/>
								<p className="text-muted-foreground text-sm">
									The main title of your blog post.
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
										// Clear error when user edits the slug
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
										The URL-friendly version of the title. This will be used in
										the post's URL.
									</p>
								)}
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
											<FileText />
											Create & Continue Editing
										</>
									)}
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => navigate({ to: '/blog-posts' })}
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
