import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	Copy,
	Grid3X3,
	ImageIcon,
	List,
	Lock,
	MoreHorizontal,
	Pencil,
	Trash2,
	Unlock,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { trpc } from '@/lib/trpc';
import { ImageDelete } from './ImageDelete';

// Image type based on DB schema
export interface Image {
	id: string;
	cfImageId: string;
	deliveryUrl: string;
	fileName: string | null;
	altText: string | null;
	width: number | null;
	height: number | null;
	requireSignedURLs: boolean;
	metadata: unknown;
	createdAt: Date;
}

interface ImageListProps {
	images: Image[] | null | undefined;
	onPageChange: (page: number) => void;
	currentPage: number;
	totalPages: number;
	total: number;
}

type ViewMode = 'grid' | 'table';

const STORAGE_KEY = 'imageList-settings';

interface ImageListSettings {
	viewMode: ViewMode;
	sortCriteria: string;
	sortDirection: string;
	tableSorting: SortingState;
}

function getStoredSettings(): ImageListSettings {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			return {
				viewMode: parsed.viewMode ?? 'grid',
				sortCriteria: parsed.sortCriteria ?? 'date',
				sortDirection: parsed.sortDirection ?? 'desc',
				tableSorting: parsed.tableSorting ?? [],
			};
		}
	} catch {
		// Ignore parse errors
	}
	return {
		viewMode: 'grid',
		sortCriteria: 'date',
		sortDirection: 'desc',
		tableSorting: [],
	};
}

// Build image URL with variant
function getImageUrl(deliveryUrl: string, variant = 'thumbnail'): string {
	// deliveryUrl format: https://imagedelivery.net/<hash>/<image-id>
	// or with custom domain: https://www.airwartrail.com/cdn-cgi/imagedelivery/<hash>/<image-id>
	return `${deliveryUrl}/${variant}`;
}

function formatDate(date: Date | string | null | undefined): string {
	if (!date) return 'N/A';
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
}

// Read stored settings once at module level
const initialSettings = getStoredSettings();

export function ImageList({
	images = [],
	onPageChange,
	currentPage,
	totalPages,
	total,
}: ImageListProps) {
	const queryClient = useQueryClient();
	const [searchTerm, setSearchTerm] = useState('');
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [imageToDelete, setImageToDelete] = useState<Image | null>(null);

	// Initialize state from stored settings
	const [sortCriteria, setSortCriteria] = useState(
		initialSettings.sortCriteria,
	);
	const [sortDirection, setSortDirection] = useState(
		initialSettings.sortDirection,
	);
	const [viewMode, setViewMode] = useState<ViewMode>(initialSettings.viewMode);
	const [tableSorting, setTableSorting] = useState<SortingState>(
		initialSettings.tableSorting,
	);

	// Ensure images is an array before filtering
	const imageArray = Array.isArray(images) ? images : [];

	const filteredImages = useMemo(() => {
		return imageArray
			.filter((image) => {
				const searchLower = searchTerm.toLowerCase();
				return (
					(image.fileName?.toLowerCase() || '').includes(searchLower) ||
					(image.altText?.toLowerCase() || '').includes(searchLower)
				);
			})
			.sort((a, b) => {
				if (sortCriteria === 'filename') {
					const aName = a.fileName || '';
					const bName = b.fileName || '';
					return sortDirection === 'asc'
						? aName.localeCompare(bName)
						: bName.localeCompare(aName);
				}
				return sortDirection === 'asc'
					? new Date(a.createdAt || 0).getTime() -
							new Date(b.createdAt || 0).getTime()
					: new Date(b.createdAt || 0).getTime() -
							new Date(a.createdAt || 0).getTime();
			});
	}, [imageArray, searchTerm, sortCriteria, sortDirection]);

	// Extract IDs of images that need signed URLs for thumbnail display
	const imageIdsNeedingSigning = useMemo(() => {
		return filteredImages
			.filter((img) => img.requireSignedURLs)
			.map((img) => img.id);
	}, [filteredImages]);

	// Fetch signed URLs for thumbnails in batch
	const { data: thumbnailSignedUrls } = useQuery({
		...trpc.cfImages.signedUrls.signBatch.queryOptions({
			imageIds: imageIdsNeedingSigning,
			variant: 'thumbnail',
			expirationSeconds: 3600,
		}),
		enabled: imageIdsNeedingSigning.length > 0,
	});

	// Create a lookup map for signed URLs
	const signedUrlMap = useMemo(() => {
		if (!thumbnailSignedUrls) return new Map<string, string>();
		const map = new Map<string, string>();
		for (const img of thumbnailSignedUrls.images) {
			map.set(img.imageId, img.url);
		}
		return map;
	}, [thumbnailSignedUrls]);

	// Track settings save with debouncing
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Persist settings to localStorage with debouncing
	useEffect(() => {
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
		}

		saveTimeoutRef.current = setTimeout(() => {
			const settings: ImageListSettings = {
				viewMode,
				sortCriteria,
				sortDirection,
				tableSorting,
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
		}, 300);

		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}
		};
	}, [viewMode, sortCriteria, sortDirection, tableSorting]);

	// Delete mutation
	const deleteImageMutation = useMutation(
		trpc.cfImages.images.deleteImage.mutationOptions({
			onSuccess: () => {
				toast.success('Image deleted successfully');
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'images', 'listImages']],
				});
			},
			onError: (error) => {
				toast.error(`Failed to delete image: ${error.message}`);
			},
		}),
	);

	const toggleSortDirection = () => {
		setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
	};

	// Helper to get the correct image URL (signed or plain)
	const getImageUrlForDisplay = useCallback(
		(image: Image, variant = 'thumbnail'): string => {
			if (image.requireSignedURLs && variant === 'thumbnail') {
				// Use the signed URL from our batch query if available
				const signedUrl = signedUrlMap.get(image.id);
				if (signedUrl) return signedUrl;
			}
			// Fallback to plain URL
			return getImageUrl(image.deliveryUrl, variant);
		},
		[signedUrlMap],
	);

	const handleCopy = useCallback(
		async (image: Image) => {
			try {
				let url: string;

				if (image.requireSignedURLs) {
					// Generate a signed URL for the public variant
					const result = await queryClient.fetchQuery(
						trpc.cfImages.signedUrls.signUrl.queryOptions({
							imageId: image.id,
							variant: 'public',
							expirationSeconds: 3600,
						}),
					);
					url = result.url;
				} else {
					url = getImageUrl(image.deliveryUrl, 'public');
				}

				await navigator.clipboard.writeText(url);
				toast.success('URL copied to clipboard');
			} catch {
				toast.error('Failed to copy URL');
			}
		},
		[queryClient],
	);

	const handleDeleteRequest = useCallback((image: Image) => {
		setImageToDelete(image);
		setIsDeleteDialogOpen(true);
	}, []);

	const handleSortingChange = useCallback(
		(updater: SortingState | ((old: SortingState) => SortingState)) => {
			setTableSorting((old) => {
				const newValue = typeof updater === 'function' ? updater(old) : updater;
				return newValue;
			});
		},
		[],
	);

	const handleDeleteConfirm = async () => {
		if (imageToDelete) {
			await deleteImageMutation.mutateAsync({
				id: imageToDelete.id,
				deleteFromCf: true,
			});
			setImageToDelete(null);
		}
	};

	// Table columns definition
	const columns = useMemo<ColumnDef<Image>[]>(
		() => [
			{
				accessorKey: 'thumbnail',
				header: '',
				size: 80,
				enableSorting: false,
				cell: ({ row }) => (
					<div className="relative h-12 w-20 overflow-hidden rounded bg-muted">
						<Link
							to="/images/edit-image/$imageId"
							params={{ imageId: row.original.id }}
							className="block h-full w-full"
						>
							<img
								src={getImageUrlForDisplay(row.original, 'thumbnail')}
								alt={row.original.altText || row.original.fileName || 'Image'}
								className="h-full w-full object-cover"
							/>
						</Link>
					</div>
				),
			},
			{
				accessorKey: 'fileName',
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
						className="-ml-4"
					>
						Filename
						<ArrowUpDown className="ml-2 h-4 w-4" />
					</Button>
				),
				cell: ({ row }) => (
					<Link
						to="/images/edit-image/$imageId"
						params={{ imageId: row.original.id }}
						className="font-medium hover:underline"
					>
						{row.original.fileName || 'Untitled'}
					</Link>
				),
			},
			{
				accessorKey: 'altText',
				header: 'Alt Text',
				cell: ({ row }) => (
					<span className="text-muted-foreground max-w-xs truncate">
						{row.original.altText || '—'}
					</span>
				),
			},
			{
				accessorKey: 'dimensions',
				header: 'Dimensions',
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{row.original.width && row.original.height
							? `${row.original.width} × ${row.original.height}`
							: '—'}
					</span>
				),
			},
			{
				accessorKey: 'requireSignedURLs',
				header: 'Access',
				cell: ({ row }) => (
					<Badge
						variant={row.original.requireSignedURLs ? 'default' : 'secondary'}
						className="gap-1"
					>
						{row.original.requireSignedURLs ? (
							<>
								<Lock className="size-3" />
								Signed
							</>
						) : (
							<>
								<Unlock className="size-3" />
								Public
							</>
						)}
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
						Uploaded
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
				cell: ({ row }) => {
					const image = row.original;
					return (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" className="h-8 w-8">
									<MoreHorizontal className="size-4" />
									<span className="sr-only">Open menu</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuLabel>Actions</DropdownMenuLabel>
								<DropdownMenuItem onClick={() => handleCopy(image)}>
									<Copy className="mr-2 size-4" />
									<span>Copy URL</span>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link
										to="/images/edit-image/$imageId"
										params={{ imageId: image.id }}
										className="flex cursor-pointer items-center px-2 py-1.5 text-sm"
									>
										<Pencil className="mr-2 size-4" />
										<span>Edit</span>
									</Link>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => handleDeleteRequest(image)}>
									<Trash2 className="text-destructive-foreground mr-2 size-4" />
									<span className="text-destructive">Delete</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					);
				},
			},
		],
		[handleCopy, handleDeleteRequest, getImageUrlForDisplay],
	);

	const table = useReactTable({
		data: filteredImages,
		columns,
		state: {
			sorting: tableSorting,
		},
		onSortingChange: handleSortingChange,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	return (
		<div className="space-y-4">
			<div className="flex justify-between gap-2">
				<Input
					placeholder="Search images..."
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
					className="max-w-sm"
				/>
				<div className="flex gap-x-2">
					{viewMode === 'grid' && (
						<>
							<Select value={sortCriteria} onValueChange={setSortCriteria}>
								<SelectTrigger className="max-w-sm">
									<SelectValue placeholder="Sort by" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="date">Sort by Date</SelectItem>
									<SelectItem value="filename">Sort by Filename</SelectItem>
								</SelectContent>
							</Select>
							<Button onClick={toggleSortDirection}>
								{sortDirection === 'asc' ? <ArrowUp /> : <ArrowDown />}
							</Button>
						</>
					)}
					<div className="flex rounded-md border">
						<Button
							variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
							size="icon"
							onClick={() => setViewMode('grid')}
							className="rounded-r-none"
						>
							<Grid3X3 className="h-4 w-4" />
							<span className="sr-only">Grid view</span>
						</Button>
						<Button
							variant={viewMode === 'table' ? 'secondary' : 'ghost'}
							size="icon"
							onClick={() => setViewMode('table')}
							className="rounded-l-none"
						>
							<List className="h-4 w-4" />
							<span className="sr-only">Table view</span>
						</Button>
					</div>
				</div>
			</div>

			<ImageDelete
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
				onConfirm={handleDeleteConfirm}
				imageName={imageToDelete?.fileName || undefined}
			/>

			{viewMode === 'table' && (
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
							) : (
								<TableRow>
									<TableCell
										colSpan={columns.length}
										className="h-24 text-center"
									>
										No images found.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			)}

			{viewMode === 'grid' && (
				<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
					{filteredImages.map((image) => (
						<Card key={image.id} className="gap-2 overflow-hidden pt-0 pb-2">
							<div className="relative aspect-3/2 overflow-hidden bg-muted">
								<Link
									to="/images/edit-image/$imageId"
									params={{ imageId: image.id }}
									className="block size-full"
								>
									<img
										src={getImageUrlForDisplay(image, 'thumbnail')}
										alt={image.altText || image.fileName || 'Image'}
										className="size-full object-cover transition-transform hover:scale-105"
									/>
								</Link>
								{image.requireSignedURLs && (
									<div className="absolute top-2 right-2">
										<Badge className="gap-1 text-xs">
											<Lock className="size-3" />
										</Badge>
									</div>
								)}
							</div>
							<CardHeader className="p-4 pt-2">
								<div className="flex items-start justify-between">
									<Link
										to="/images/edit-image/$imageId"
										params={{ imageId: image.id }}
										className="cursor-pointer"
									>
										<CardTitle className="line-clamp-1 text-sm">
											{image.fileName || 'Untitled'}
										</CardTitle>
									</Link>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="ghost" size="icon" className="h-8 w-8">
												<MoreHorizontal className="size-4" />
												<span className="sr-only">Open menu</span>
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuLabel>Actions</DropdownMenuLabel>
											<DropdownMenuItem onClick={() => handleCopy(image)}>
												<Copy className="mr-2 size-4" />
												<span>Copy URL</span>
											</DropdownMenuItem>
											<DropdownMenuItem asChild>
												<Link
													to="/images/edit-image/$imageId"
													params={{ imageId: image.id }}
													className="flex cursor-pointer items-center px-2 py-1.5 text-sm"
												>
													<Pencil className="mr-2 size-4" />
													<span>Edit</span>
												</Link>
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												onClick={() => handleDeleteRequest(image)}
											>
												<Trash2 className="text-destructive-foreground mr-2 size-4" />
												<span className="text-destructive">Delete</span>
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
								<CardDescription className="line-clamp-2 text-xs">
									{image.altText || 'No description'}
								</CardDescription>
							</CardHeader>
							<CardFooter className="text-muted-foreground flex items-center justify-between p-4 pt-0 text-xs">
								<span>
									{image.width && image.height
										? `${image.width} × ${image.height}`
										: 'Unknown size'}
								</span>
								<span>{formatDate(image.createdAt)}</span>
							</CardFooter>
						</Card>
					))}
				</div>
			)}

			{filteredImages.length === 0 && viewMode === 'grid' && (
				<div className="flex flex-col items-center justify-center py-12 text-center">
					<ImageIcon className="text-muted-foreground mb-4 h-12 w-12" />
					<h3 className="text-lg font-medium">No images found</h3>
					<p className="text-muted-foreground">
						{searchTerm
							? 'Try a different search term'
							: 'Upload your first image to get started'}
					</p>
				</div>
			)}

			{/* Pagination Controls */}
			{totalPages > 1 && (
				<div className="flex items-center justify-between border-t pt-4">
					<p className="text-muted-foreground text-sm">
						Showing {(currentPage - 1) * 50 + 1} to{' '}
						{Math.min(currentPage * 50, total)} of {total} images
					</p>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => onPageChange(currentPage - 1)}
							disabled={currentPage <= 1}
						>
							Previous
						</Button>
						<div className="flex items-center gap-1">
							{Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
								let pageNum: number;
								if (totalPages <= 5) {
									pageNum = i + 1;
								} else if (currentPage <= 3) {
									pageNum = i + 1;
								} else if (currentPage >= totalPages - 2) {
									pageNum = totalPages - 4 + i;
								} else {
									pageNum = currentPage - 2 + i;
								}
								return (
									<Button
										key={pageNum}
										variant={pageNum === currentPage ? 'default' : 'outline'}
										size="sm"
										onClick={() => onPageChange(pageNum)}
										className="w-9"
									>
										{pageNum}
									</Button>
								);
							})}
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={() => onPageChange(currentPage + 1)}
							disabled={currentPage >= totalPages}
						>
							Next
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
