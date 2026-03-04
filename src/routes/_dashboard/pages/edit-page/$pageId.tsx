import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import {
	CalendarDays,
	FileText,
	Loader2,
	Save,
	Trash2,
	TriangleAlert,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TiptapEditor } from '@/components/blog/TiptapEditor';
import { DashboardHeader } from '@/components/DashboardHeader';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_dashboard/pages/edit-page/$pageId')({
	loader: async ({ context: { queryClient }, params: { pageId } }) => {
		if (!pageId) {
			return { pageId };
		}
		await queryClient.ensureQueryData(
			trpc.pages.get.queryOptions({ id: pageId }),
		);
	},
	component: EditPagePage,
});

type PublishStatus = 'published' | 'unpublished';

function EditPagePage() {
	const { pageId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const {
		data: page,
		isLoading,
		error,
	} = useQuery(trpc.pages.get.queryOptions({ id: pageId }));

	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [slugError, setSlugError] = useState<string | null>(null);
	const [pageContent, setPageContent] = useState<unknown>(null);
	const [publishStatus, setPublishStatus] =
		useState<PublishStatus>('unpublished');
	const [publishedAt, setPublishedAt] = useState<Date | null>(null);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	useEffect(() => {
		if (page) {
			setTitle(page.title || '');
			setSlug(page.slug || '');
			setPageContent(page.pageContent);
			setPublishStatus(page.publishStatus);
			setPublishedAt(page.publishedAt ? new Date(page.publishedAt) : null);
		}
	}, [page]);

	const updateMutation = useMutation(
		trpc.pages.update.mutationOptions({
			onSuccess: (data) => {
				toast.success('Page saved successfully');
				setPublishStatus(data.publishStatus);
				if (data.publishedAt) {
					setPublishedAt(new Date(data.publishedAt));
				}
				queryClient.invalidateQueries({
					queryKey: trpc.pages.get.queryKey({ id: pageId }),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.pages.list.queryKey(),
				});
			},
			onError: (error) => {
				if (
					error.data?.code === 'CONFLICT' ||
					error.message.toLowerCase().includes('slug')
				) {
					setSlugError(
						'A page with this slug already exists. Please choose a different slug.',
					);
					toast.error('Slug already exists', {
						description: 'Please choose a different URL slug.',
					});
				} else {
					toast.error('Failed to save page', {
						description: error.message || 'An unexpected error occurred',
					});
				}
			},
		}),
	);

	const deleteMutation = useMutation(
		trpc.pages.delete.mutationOptions({
			onSuccess: () => {
				toast.success('Page deleted successfully');
				navigate({ to: '/pages' });
			},
			onError: (error) => {
				toast.error('Failed to delete page', {
					description: error.message || 'An unexpected error occurred',
				});
				setIsDeleteDialogOpen(false);
			},
		}),
	);

	const isAnyMutationPending =
		updateMutation.isPending || deleteMutation.isPending;

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
			id: pageId,
			title: title.trim(),
			slug: slug.trim(),
			pageContent,
			publishStatus,
			publishedAt,
		});
	};

	if (error) {
		return (
			<>
				<DashboardHeader heading="Edit Page" text="Error loading page." />
				<div className="p-6">
					<div className="text-destructive">Error: {error.message}</div>
				</div>
			</>
		);
	}

	return (
		<>
			<DashboardHeader
				heading="Edit Update"
				text="Edit update on the Coming Soon page."
			>
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink asChild>
								<Link to="/pages">&larr; Back to Updates</Link>
							</BreadcrumbLink>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</DashboardHeader>

			{isLoading ? (
				<div className="p-6 space-y-4">
					<Skeleton className="h-8 w-1/3" />
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-96 w-full" />
				</div>
			) : (
				<div className="p-6 space-y-6">
					<div className="grid gap-6 lg:grid-cols-[1fr_350px]">
						<div className="space-y-6">
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<FileText className="size-5" />
										Page Content
									</CardTitle>
									<CardDescription>
										The main content of your page.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<TiptapEditor
										content={pageContent}
										onChange={setPageContent}
										disabled={isAnyMutationPending}
										placeholder="Write your page content here..."
									/>
								</CardContent>
							</Card>
						</div>

						<div className="space-y-6">
							<Card>
								<CardHeader>
									<CardTitle>Page Settings</CardTitle>
									<CardDescription>
										Configure your page settings.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="title">Title *</Label>
										<Input
											id="title"
											type="text"
											placeholder="Enter page title"
											value={title}
											onChange={(e) => setTitle(e.target.value)}
											disabled={isAnyMutationPending}
											required
										/>
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
											disabled={isAnyMutationPending}
											required
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
												<SelectItem value="published">Published</SelectItem>
												<SelectItem value="unpublished">Unpublished</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label>Publish Date</Label>
										<Popover>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													className="w-full justify-start text-left font-normal"
													disabled={isAnyMutationPending}
												>
													<CalendarDays className="mr-2 size-4" />
													{publishedAt
														? format(publishedAt, 'PPP')
														: 'Select date'}
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0">
												<Calendar
													mode="single"
													selected={publishedAt || undefined}
													onSelect={(date) => setPublishedAt(date || null)}
													initialFocus
												/>
											</PopoverContent>
										</Popover>
									</div>

									<Button
										onClick={handleSave}
										disabled={isAnyMutationPending}
										className="w-full"
									>
										{isAnyMutationPending ? (
											<Loader2 className="animate-spin" />
										) : (
											<Save className="size-4" />
										)}
										Save
									</Button>
								</CardContent>
							</Card>

							<Card className="border-destructive">
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-destructive">
										<TriangleAlert className="size-5" />
										Danger Zone
									</CardTitle>
									<CardDescription>
										Irreversible actions for this page.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<Button
										variant="destructive"
										className="w-full"
										onClick={() => setIsDeleteDialogOpen(true)}
										disabled={isAnyMutationPending}
									>
										<Trash2 className="size-4" />
										Delete Page
									</Button>
								</CardContent>
							</Card>
						</div>
					</div>
				</div>
			)}

			<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Page</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this page? This action cannot be
							undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsDeleteDialogOpen(false)}
							disabled={isAnyMutationPending}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() => deleteMutation.mutate({ id: pageId })}
							disabled={isAnyMutationPending}
						>
							{isAnyMutationPending ? (
								<Loader2 className="animate-spin" />
							) : null}
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
