import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from '@tanstack/react-table';
import {
	ArrowUpDown,
	MoreHorizontal,
	Pencil,
	Plus,
	Tag,
	Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_dashboard/tags/')({
	component: TagsPage,
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData(trpc.mux.listTags.queryOptions());
		await queryClient.ensureQueryData(
			trpc.mux.getTagStatistics.queryOptions({}),
		);
	},
});

// Type for tag from the API
interface VideoTag {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

// Validation schemas
const tagNameSchema = z
	.string()
	.min(1, 'Tag name is required')
	.max(50, 'Tag name must be 50 characters or less')
	.regex(
		/^[a-zA-Z0-9:@._\- ]+$/,
		'Tags may only include letters, numbers, spaces, and : @ . _ -',
	);

const tagDescriptionSchema = z
	.string()
	.max(200, 'Description must be 200 characters or less')
	.optional();

// Create Tag Dialog Component
function CreateTagDialog() {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [errors, setErrors] = useState<{ name?: string; description?: string }>(
		{},
	);

	const createMutation = useMutation(
		trpc.mux.createTag.mutationOptions({
			onSuccess: () => {
				toast.success('Tag created successfully');
				queryClient.invalidateQueries({ queryKey: [['mux', 'listTags']] });
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getTagStatistics']],
				});
				setOpen(false);
				resetForm();
			},
			onError: (error) => {
				toast.error(`Failed to create tag: ${error.message}`);
			},
		}),
	);

	const resetForm = () => {
		setName('');
		setDescription('');
		setErrors({});
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const nameValidation = tagNameSchema.safeParse(name);
		const descriptionValidation = tagDescriptionSchema.safeParse(
			description || undefined,
		);

		const newErrors: { name?: string; description?: string } = {};
		if (!nameValidation.success) {
			newErrors.name = nameValidation.error.issues[0].message;
		}
		if (!descriptionValidation.success) {
			newErrors.description = descriptionValidation.error.issues[0].message;
		}

		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			return;
		}

		createMutation.mutate({
			name: name.trim(),
			description: description.trim() || undefined,
		});
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button>
					<Plus />
					Create Tag
				</Button>
			</DialogTrigger>
			<DialogContent>
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Create New Tag</DialogTitle>
						<DialogDescription>
							Create a new tag that can be assigned to videos for organization
							and search.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="name">Tag Name</Label>
							<Input
								id="name"
								value={name}
								onChange={(e) => {
									setName(e.target.value);
									setErrors((prev) => ({ ...prev, name: undefined }));
								}}
								placeholder="Enter tag name"
								maxLength={50}
								aria-invalid={Boolean(errors.name)}
							/>
							{errors.name && (
								<p className="text-sm text-destructive">{errors.name}</p>
							)}
						</div>
						<div className="space-y-2">
							<Label htmlFor="description">Description (optional)</Label>
							<Textarea
								id="description"
								value={description}
								onChange={(e) => {
									setDescription(e.target.value);
									setErrors((prev) => ({ ...prev, description: undefined }));
								}}
								placeholder="Enter a description for this tag"
								maxLength={200}
								rows={3}
								aria-invalid={Boolean(errors.description)}
							/>
							{errors.description && (
								<p className="text-sm text-destructive">{errors.description}</p>
							)}
							<p className="text-sm text-muted-foreground">
								{description.length}/200 characters
							</p>
						</div>
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="outline" onClick={resetForm}>
								Cancel
							</Button>
						</DialogClose>
						<Button type="submit" disabled={createMutation.isPending}>
							{createMutation.isPending ? 'Creating...' : 'Create Tag'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// Edit Tag Dialog Component
function EditTagDialog({
	tag,
	open,
	onOpenChange,
}: {
	tag: VideoTag;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const [name, setName] = useState(tag.name);
	const [description, setDescription] = useState(tag.description ?? '');
	const [errors, setErrors] = useState<{ name?: string; description?: string }>(
		{},
	);

	const updateMutation = useMutation(
		trpc.mux.updateTag.mutationOptions({
			onSuccess: () => {
				toast.success('Tag updated successfully');
				queryClient.invalidateQueries({ queryKey: [['mux', 'listTags']] });
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getTagStatistics']],
				});
				onOpenChange(false);
			},
			onError: (error) => {
				toast.error(`Failed to update tag: ${error.message}`);
			},
		}),
	);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const nameValidation = tagNameSchema.safeParse(name);
		const descriptionValidation = tagDescriptionSchema.safeParse(
			description || undefined,
		);

		const newErrors: { name?: string; description?: string } = {};
		if (!nameValidation.success) {
			newErrors.name = nameValidation.error.issues[0].message;
		}
		if (!descriptionValidation.success) {
			newErrors.description = descriptionValidation.error.issues[0].message;
		}

		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			return;
		}

		updateMutation.mutate({
			tagId: tag.id,
			name: name.trim(),
			description: description.trim() || null,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Edit Tag</DialogTitle>
						<DialogDescription>
							Update the tag name and description.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="edit-name">Tag Name</Label>
							<Input
								id="edit-name"
								value={name}
								onChange={(e) => {
									setName(e.target.value);
									setErrors((prev) => ({ ...prev, name: undefined }));
								}}
								placeholder="Enter tag name"
								maxLength={50}
								aria-invalid={Boolean(errors.name)}
							/>
							{errors.name && (
								<p className="text-sm text-destructive">{errors.name}</p>
							)}
						</div>
						<div className="space-y-2">
							<Label htmlFor="edit-description">Description (optional)</Label>
							<Textarea
								id="edit-description"
								value={description}
								onChange={(e) => {
									setDescription(e.target.value);
									setErrors((prev) => ({ ...prev, description: undefined }));
								}}
								placeholder="Enter a description for this tag"
								maxLength={200}
								rows={3}
								aria-invalid={Boolean(errors.description)}
							/>
							{errors.description && (
								<p className="text-sm text-destructive">{errors.description}</p>
							)}
							<p className="text-sm text-muted-foreground">
								{description.length}/200 characters
							</p>
						</div>
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="outline">
								Cancel
							</Button>
						</DialogClose>
						<Button type="submit" disabled={updateMutation.isPending}>
							{updateMutation.isPending ? 'Saving...' : 'Save Changes'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// Delete Tag Dialog Component
function DeleteTagDialog({
	tag,
	videoCount,
	open,
	onOpenChange,
}: {
	tag: VideoTag;
	videoCount: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();

	const deleteMutation = useMutation(
		trpc.mux.deleteTag.mutationOptions({
			onSuccess: () => {
				toast.success('Tag deleted successfully');
				queryClient.invalidateQueries({ queryKey: [['mux', 'listTags']] });
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getTagStatistics']],
				});
				onOpenChange(false);
			},
			onError: (error) => {
				toast.error(`Failed to delete tag: ${error.message}`);
			},
		}),
	);

	const handleDelete = () => {
		deleteMutation.mutate({ tagId: tag.id });
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete Tag</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete the tag "{tag.name}"?
						{videoCount > 0 && (
							<span className="block mt-2 text-destructive">
								This tag is currently assigned to {videoCount} video
								{videoCount > 1 ? 's' : ''}. The tag will be removed from all
								videos.
							</span>
						)}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={deleteMutation.isPending}
					>
						{deleteMutation.isPending ? 'Deleting...' : 'Delete Tag'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// Tag row with actions
interface TagRowData extends VideoTag {
	videoCount: number;
}

function TagActions({ tag }: { tag: TagRowData }) {
	const [editOpen, setEditOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon" className="h-8 w-8">
						<MoreHorizontal className="size-4" />
						<span className="sr-only">Open menu</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuLabel>Actions</DropdownMenuLabel>
					<DropdownMenuItem onClick={() => setEditOpen(true)}>
						<Pencil className="mr-2 size-4" />
						<span>Edit</span>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={() => setDeleteOpen(true)}>
						<Trash2 className="text-destructive-foreground mr-2 size-4" />
						<span className="text-destructive">Delete</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<EditTagDialog tag={tag} open={editOpen} onOpenChange={setEditOpen} />
			<DeleteTagDialog
				tag={tag}
				videoCount={tag.videoCount}
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
			/>
		</>
	);
}

function formatDate(date: Date | string | null | undefined): string {
	if (!date) return '—';
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
}

function TagsPage() {
	const [searchTerm, setSearchTerm] = useState('');
	const [sorting, setSorting] = useState<SortingState>([]);

	const {
		data: tags,
		isLoading,
		error,
	} = useQuery(trpc.mux.listTags.queryOptions());

	const { data: statistics } = useQuery(
		trpc.mux.getTagStatistics.queryOptions({}),
	);

	// Create a map of tag statistics for quick lookup
	const statsMap = useMemo(() => {
		const map = new Map<string, number>();
		if (statistics) {
			for (const stat of statistics) {
				map.set(stat.tagId, stat.videoCount);
			}
		}
		return map;
	}, [statistics]);

	// Merge tags with their video counts
	const tagsWithCounts: TagRowData[] = useMemo(() => {
		if (!tags) return [];
		return tags.map((tag) => ({
			...tag,
			videoCount: statsMap.get(tag.id) ?? 0,
		}));
	}, [tags, statsMap]);

	// Table columns definition
	const columns = useMemo<ColumnDef<TagRowData>[]>(
		() => [
			{
				accessorKey: 'name',
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
						className="-ml-4"
					>
						Tag Name
						<ArrowUpDown className="ml-2 h-4 w-4" />
					</Button>
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<Tag className="size-4 text-muted-foreground" />
						<span className="font-medium">{row.original.name}</span>
					</div>
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
				accessorKey: 'description',
				header: 'Description',
				cell: ({ row }) => (
					<span className="text-muted-foreground text-sm max-w-xs truncate block">
						{row.original.description || '—'}
					</span>
				),
			},
			{
				accessorKey: 'videoCount',
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
						className="-ml-4"
					>
						Videos
						<ArrowUpDown className="ml-2 h-4 w-4" />
					</Button>
				),
				cell: ({ row }) => (
					<Badge variant="secondary">
						{row.original.videoCount.toLocaleString()}
					</Badge>
				),
			},
			{
				accessorKey: 'createdAt',
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
						className="-ml-4"
					>
						Created
						<ArrowUpDown className="ml-2 h-4 w-4" />
					</Button>
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground text-sm">
						{formatDate(row.original.createdAt)}
					</span>
				),
			},
			{
				id: 'actions',
				header: '',
				size: 50,
				enableSorting: false,
				cell: ({ row }) => <TagActions tag={row.original} />,
			},
		],
		[],
	);

	const table = useReactTable({
		data: tagsWithCounts,
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
				Error loading tags: {error.message}
			</div>
		);
	}

	return (
		<>
			<DashboardHeader
				heading="Tags"
				text="Manage tags for organizing and categorizing videos."
			/>

			<section className="space-y-4">
				<div className="flex justify-between gap-2">
					<Input
						placeholder="Search tags..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="max-w-sm"
					/>
					<CreateTagDialog />
				</div>

				{isLoading ? (
					<div className="text-muted-foreground">Loading tags...</div>
				) : tagsWithCounts.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<Tag className="size-12 text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold">No tags yet</h3>
						<p className="text-muted-foreground mb-4">
							Create your first tag to start organizing videos.
						</p>
						<CreateTagDialog />
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
											No tags found.
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

				{tagsWithCounts.length > 0 && (
					<div className="flex items-center justify-between text-sm text-muted-foreground">
						<span>
							{table.getFilteredRowModel().rows.length} of{' '}
							{tagsWithCounts.length} tag
							{tagsWithCounts.length !== 1 ? 's' : ''}
						</span>
					</div>
				)}
			</section>
		</>
	);
}
