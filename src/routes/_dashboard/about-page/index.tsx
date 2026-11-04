import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { format } from 'date-fns';
import { Info, Loader2, Minus, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TiptapEditor } from '@/components/blog/TiptapEditor';
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
import { trpc } from '@/lib/trpc';

const SITE_CONTENT_KEY = 'about';

export const Route = createFileRoute('/_dashboard/about-page/')({
	loader: async ({ context: { queryClient } }) => {
		await queryClient.query({
			...trpc.siteContent.get.queryOptions({ key: SITE_CONTENT_KEY }),
			staleTime: 'static',
		});
	},
	component: AboutPageEditor,
});

function AboutPageEditor() {
	const queryClient = useQueryClient();

	const {
		data: aboutPage,
		isLoading,
		error,
	} = useQuery(trpc.siteContent.get.queryOptions({ key: SITE_CONTENT_KEY }));

	const [content, setContent] = useState<unknown>(null);

	useEffect(() => {
		if (aboutPage) {
			setContent(aboutPage.content);
		}
	}, [aboutPage]);

	const updateMutation = useMutation(
		trpc.siteContent.update.mutationOptions({
			onSuccess: () => {
				toast.success('About page saved successfully');
				queryClient.invalidateQueries({
					queryKey: trpc.siteContent.get.queryKey({ key: SITE_CONTENT_KEY }),
				});
			},
			onError: (error) => {
				toast.error('Failed to save About page', {
					description: error.message || 'An unexpected error occurred',
				});
			},
		}),
	);

	const handleSave = () => {
		updateMutation.mutate({ key: SITE_CONTENT_KEY, content });
	};

	if (error) {
		return (
			<>
				<DashboardHeader
					heading="About Page"
					text="Error loading About page content."
				/>
				<div className="p-6">
					<div className="text-destructive">Error: {error.message}</div>
				</div>
			</>
		);
	}

	return (
		<>
			<DashboardHeader
				heading="About Page"
				text="Edit the main content of the About page on the frontend."
			/>

			{isLoading ? (
				<div className="p-6 space-y-4">
					<Skeleton className="h-8 w-1/3" />
					<Skeleton className="h-96 w-full" />
				</div>
			) : (
				<div className="p-6 space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Info className="size-5" />
								About Page Content
							</CardTitle>
							<CardDescription>
								Content above the first horizontal line{' '}
								<Minus className="inline size-4" /> is shown beside the video on
								desktop. Everything below it runs full width under the video.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<TiptapEditor
								content={content}
								onChange={setContent}
								disabled={updateMutation.isPending}
								placeholder="Write the About page content here..."
							/>
							<div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
								<p className="text-muted-foreground text-sm">
									{aboutPage?.updatedAt
										? `Last updated ${format(new Date(aboutPage.updatedAt), 'PPP p')}${aboutPage.updatedBy ? ` by ${aboutPage.updatedBy}` : ''}`
										: 'Not saved yet'}
								</p>
								<Button
									onClick={handleSave}
									disabled={updateMutation.isPending}
								>
									{updateMutation.isPending ? (
										<Loader2 className="animate-spin" />
									) : (
										<Save className="size-4" />
									)}
									Save
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			)}
		</>
	);
}
