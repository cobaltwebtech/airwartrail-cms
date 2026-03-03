import { Link } from '@tanstack/react-router';
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from '@tanstack/react-table';
import {
	Archive,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	CloudDownload,
	Copy,
	Eye,
	EyeOff,
	File,
	MoreHorizontal,
	Pencil,
	Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

export type Document = {
	id: string;
	name: string;
	description: string | null;
	fileUrl: string;
	fileSize: number | null;
	mimeType: string | null;
	publishStatus: 'draft' | 'published' | 'archived';
	author: string;
	authorId: string | null;
	createdAt: Date;
	updatedAt: Date;
};

interface DocumentListProps {
	documents: Document[] | null | undefined;
	onPageChange: (page: number) => void;
	currentPage: number;
	totalPages: number;
	total: number;
	onStatusChange: (
		id: string,
		status: 'draft' | 'published' | 'archived',
	) => void;
	onDelete: (id: string) => void;
	onEditDescription: (id: string) => void;
}

function formatFileSize(bytes: number | null): string {
	if (bytes === null || bytes === 0) return 'Unknown';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

function formatDate(date: Date): string {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	}).format(new Date(date));
}

export function DocumentList({
	documents,
	onPageChange,
	currentPage,
	totalPages,
	total,
	onStatusChange,
	onDelete,
	onEditDescription,
}: DocumentListProps) {
	const [sorting, setSorting] = useState<SortingState>([
		{ id: 'createdAt', desc: true },
	]);

	const columns = useMemo<ColumnDef<Document>[]>(
		() => [
			{
				accessorKey: 'name',
				header: ({ column }) => {
					return (
						<Button
							variant="ghost"
							onClick={() =>
								column.toggleSorting(column.getIsSorted() === 'asc')
							}
						>
							Name
							{{
								asc: <ArrowUp className="ml-2 h-4 w-4" />,
								desc: <ArrowDown className="ml-2 h-4 w-4" />,
							}[column.getIsSorted() as string] ?? (
								<ArrowUpDown className="ml-2 h-4 w-4" />
							)}
						</Button>
					);
				},
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<File className="h-4 w-4 text-muted-foreground" />
						<span className="font-medium">{row.original.name}</span>
					</div>
				),
			},
			{
				accessorKey: 'description',
				header: 'Description',
				cell: ({ row }) => (
					<div className="max-w-50 truncate text-muted-foreground">
						{row.original.description || '-'}
					</div>
				),
			},
			{
				accessorKey: 'fileSize',
				header: 'Size',
				cell: ({ row }) => formatFileSize(row.original.fileSize),
			},
			{
				accessorKey: 'mimeType',
				header: 'Type',
				cell: ({ row }) => (
					<Badge variant="outline">
						{row.original.mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}
					</Badge>
				),
			},
			{
				accessorKey: 'publishStatus',
				header: 'Status',
				cell: ({ row }) => {
					const status = row.original.publishStatus;
					return (
						<Badge
							variant={
								status === 'published'
									? 'default'
									: status === 'draft'
										? 'secondary'
										: 'outline'
							}
						>
							{status}
						</Badge>
					);
				},
			},
			{
				accessorKey: 'createdAt',
				header: ({ column }) => {
					return (
						<Button
							variant="ghost"
							onClick={() =>
								column.toggleSorting(column.getIsSorted() === 'asc')
							}
						>
							Created
							{{
								asc: <ArrowUp className="ml-2 h-4 w-4" />,
								desc: <ArrowDown className="ml-2 h-4 w-4" />,
							}[column.getIsSorted() as string] ?? (
								<ArrowUpDown className="ml-2 h-4 w-4" />
							)}
						</Button>
					);
				},
				cell: ({ row }) => formatDate(row.original.createdAt),
			},
			{
				id: 'actions',
				cell: ({ row }) => {
					const doc = row.original;
					return (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" className="h-8 w-8 p-0">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuLabel>Actions</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => {
										navigator.clipboard.writeText(doc.fileUrl);
										toast.success('URL copied to clipboard');
									}}
								>
									<Copy className="size-4" />
									Copy URL
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => window.open(doc.fileUrl, '_blank')}
								>
									<CloudDownload className="size-4" />
									View/Download
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => onEditDescription(doc.id)}>
									<Pencil className="size-4" />
									Edit File Info
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								{doc.publishStatus !== 'published' && (
									<DropdownMenuItem
										onClick={() => onStatusChange(doc.id, 'published')}
									>
										<Eye className="size-4" />
										Publish
									</DropdownMenuItem>
								)}
								{doc.publishStatus !== 'draft' && (
									<DropdownMenuItem
										onClick={() => onStatusChange(doc.id, 'draft')}
									>
										<EyeOff className="size-4" />
										Unpublish
									</DropdownMenuItem>
								)}
								{doc.publishStatus !== 'archived' && (
									<DropdownMenuItem
										onClick={() => onStatusChange(doc.id, 'archived')}
									>
										<Archive className="size-4" />
										Archive
									</DropdownMenuItem>
								)}
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="text-destructive focus:text-destructive"
									onClick={() => onDelete(doc.id)}
								>
									<Trash2 className="size-4 text-destructive" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					);
				},
			},
		],
		[onStatusChange, onDelete, onEditDescription],
	);

	const table = useReactTable({
		data: documents || [],
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onSortingChange: setSorting,
		state: {
			sorting,
		},
	});

	if (!documents || documents.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
				<File className="mb-4 h-12 w-12 text-muted-foreground" />
				<h3 className="mb-2 text-lg font-semibold">No documents yet</h3>
				<p className="mb-4 text-sm text-muted-foreground">
					Upload your first document to get started.
				</p>
				<Button asChild>
					<Link to="/documents/upload">Upload Document</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-4">
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
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && 'selected'}
								>
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
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<div className="flex items-center justify-between">
				<div className="text-sm text-muted-foreground">
					Showing {documents.length} of {total} documents
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={currentPage <= 1}
						onClick={() => onPageChange(currentPage - 1)}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={currentPage >= totalPages}
						onClick={() => onPageChange(currentPage + 1)}
					>
						Next
					</Button>
				</div>
			</div>
		</div>
	);
}
