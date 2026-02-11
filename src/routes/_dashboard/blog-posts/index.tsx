import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown, Edit, FileText, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_dashboard/blog-posts/')({
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData(
			trpc.blog.list.queryOptions({
				sortBy: 'publishedAt',
				sortOrder: 'desc',
				limit: 100,
			}),
		);
	},
	component: BlogPostsPage,
});

type PublishStatus = 'draft' | 'published' | 'archived';

interface BlogPost {
	id: string;
	slug: string;
	title: string;
	shortDescription: string | null;
	publishStatus: PublishStatus;
	publishedAt: Date | null;
	author: string;
	isFeatured: boolean;
	createdAt: Date;
	updatedAt: Date;
}

function BlogPostsPage() {
	const [sorting, setSorting] = useState<SortingState>([
		{ id: 'publishedAt', desc: true },
	]);
	const [searchTerm, setSearchTerm] = useState('');

	const {
		data: postsData,
		isLoading,
		error,
	} = useQuery(
		trpc.blog.list.queryOptions({
			sortBy: 'publishedAt',
			sortOrder: 'desc',
			limit: 100,
		}),
	);

	const columns = useMemo<ColumnDef<BlogPost>[]>(
		() => [
			{
				accessorKey: 'title',
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
					>
						Title
						<ArrowUpDown className="size-4" />
					</Button>
				),
				cell: ({ row }) => (
					<Link
						to="/blog-posts/edit-post/$postId"
						params={{ postId: row.original.id }}
						className="px-4 font-medium hover:underline"
					>
						{row.original.title}
					</Link>
				),
			},
			{
				accessorKey: 'slug',
				header: 'Slug',
				cell: ({ row }) => (
					<code className="text-sm text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
						{row.original.slug}
					</code>
				),
			},
			{
				accessorKey: 'publishStatus',
				header: 'Status',
				cell: ({ row }) => <StatusBadge status={row.original.publishStatus} />,
			},
			{
				accessorKey: 'publishedAt',
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
					>
						Published
						<ArrowUpDown className="size-4" />
					</Button>
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground text-sm">
						{row.original.publishedAt
							? new Date(row.original.publishedAt).toLocaleDateString('en-US', {
									year: 'numeric',
									month: 'short',
									day: 'numeric',
								})
							: 'Not published'}
					</span>
				),
			},
			{
				accessorKey: 'createdAt',
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
					>
						Created
						<ArrowUpDown className="size-4" />
					</Button>
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground text-sm">
						{new Date(row.original.createdAt).toLocaleDateString('en-US', {
							year: 'numeric',
							month: 'short',
							day: 'numeric',
						})}
					</span>
				),
			},
			{
				id: 'actions',
				header: 'Edit Post',
				cell: ({ row }) => (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline" size="icon" asChild>
									<Link
										to="/blog-posts/edit-post/$postId"
										params={{ postId: row.original.id }}
									>
										<Edit className="size-4" />
									</Link>
								</Button>
							</TooltipTrigger>
							<TooltipContent>Edit {row.original.title}</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				),
			},
		],
		[],
	);

	const posts = postsData?.blogPosts ?? [];

	const table = useReactTable({
		data: posts,
		columns,
		state: {
			sorting,
			globalFilter: searchTerm,
		},
		onSortingChange: setSorting,
		onGlobalFilterChange: setSearchTerm,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	});

	if (error) {
		return (
			<div className="text-destructive">
				Error loading posts: {error.message}
			</div>
		);
	}

	return (
		<>
			<DashboardHeader
				heading="Blog Posts"
				text="Manage your blog posts and content."
			/>

			<section className="space-y-4">
				<div className="flex justify-between gap-2">
					<Input
						placeholder="Search posts..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="max-w-sm"
					/>
					<Button asChild>
						<Link to="/blog-posts/create-post">
							<Plus />
							Create Post
						</Link>
					</Button>
				</div>

				{isLoading ? (
					<div className="text-muted-foreground">Loading posts...</div>
				) : posts.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<FileText className="size-12 text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold">No Blog Posts Yet</h3>
						<p className="text-muted-foreground mb-4 max-w-sm">
							Create your first blog post to start sharing content with your
							audience.
						</p>
						<Button asChild>
							<Link to="/blog-posts/create-post">
								<Plus />
								Create Your First Post
							</Link>
						</Button>
					</div>
				) : (
					<div className="rounded-md border">
						<Table>
							<TableHeader>
								{table.getHeaderGroups().map((headerGroup) => (
									<TableRow key={headerGroup.id}>
										{headerGroup.headers.map((header) => (
											<TableHead key={header.id}>
												{header.isPlaceholder
													? null
													: flexRender(
															header.column.columnDef.header,
															header.getContext(),
														)}
											</TableHead>
										))}
									</TableRow>
								))}
							</TableHeader>
							<TableBody>
								{table.getRowModel().rows.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={columns.length}
											className="h-24 text-center"
										>
											No posts found.
										</TableCell>
									</TableRow>
								) : (
									table.getRowModel().rows.map((row) => (
										<TableRow key={row.id}>
											{row.getVisibleCells().map((cell) => (
												<TableCell key={cell.id}>
													{flexRender(
														cell.column.columnDef.cell,
														cell.getContext(),
													)}
												</TableCell>
											))}
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				)}

				{posts.length > 0 && (
					<div className="flex items-center justify-between text-sm text-muted-foreground">
						<span>
							{table.getFilteredRowModel().rows.length} of {posts.length} post
							{posts.length !== 1 ? 's' : ''}
						</span>
					</div>
				)}
			</section>
		</>
	);
}

function StatusBadge({ status }: { status: PublishStatus }) {
	switch (status) {
		case 'published':
			return <Badge variant="accent">Published</Badge>;
		case 'draft':
			return <Badge variant="secondary">Draft</Badge>;
		case 'archived':
			return <Badge variant="destructive">Archived</Badge>;
		default:
			return null;
	}
}
