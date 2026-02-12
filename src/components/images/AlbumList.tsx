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
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import {
	Archive,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	Eye,
	EyeOff,
	FolderOpen,
	Grid3X3,
	ImageIcon,
	List,
	MoreHorizontal,
	Pencil,
	Trash2,
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
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
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

// Album type based on DB schema + cover image
export interface Album {
	id: string;
	slug: string;
	title: string;
	description: string | null;
	coverImageId: string | null;
	publishStatus: 'draft' | 'published' | 'archived';
	authorId: string | null;
	imageCount: number;
	createdAt: Date;
	updatedAt: Date;
	coverImage: {
		id: string;
		deliveryUrl: string;
		fileName: string | null;
		requireSignedURLs: boolean;
	} | null;
}

interface AlbumListProps {
	albums: Album[] | null | undefined;
	onPageChange: (page: number) => void;
	currentPage: number;
	totalPages: number;
	total: number;
}

type ViewMode = 'grid' | 'table';

const STORAGE_KEY = 'albumList-settings';

interface AlbumListSettings {
	viewMode: ViewMode;
	sortCriteria: string;
	sortDirection: string;
	tableSorting: SortingState;
}

function getStoredSettings(): AlbumListSettings {
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
function getImageUrl(deliveryUrl: string, variant = 'thumbsm'): string {
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

function getStatusBadge(status: Album['publishStatus']) {
	switch (status) {
		case 'published':
			return <Badge variant="default">Published</Badge>;
		case 'draft':
			return <Badge variant="secondary">Draft</Badge>;
		case 'archived':
			return <Badge variant="outline">Archived</Badge>;
	}
}

// Read stored settings once at module level
const initialSettings = getStoredSettings();

export function AlbumList({
	albums = [],
	onPageChange,
	currentPage,
	totalPages,
	total,
}: AlbumListProps) {
	const queryClient = useQueryClient();
	const [searchTerm, setSearchTerm] = useState('');
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [albumToDelete, setAlbumToDelete] = useState<Album | null>(null);

	// Refs for virtualization
	const gridParentRef = useRef<HTMLDivElement>(null);
	const tableParentRef = useRef<HTMLDivElement>(null);
	const gridParentOffsetRef = useRef(0);
	const tableParentOffsetRef = useRef(0);

	// Track column count for grid virtualization (matches CSS breakpoints)
	const [columnCount, setColumnCount] = useState(() => {
		if (typeof window === 'undefined') return 4;
		const width = window.innerWidth;
		if (width >= 1024) return 4; // lg
		if (width >= 768) return 3; // md
		if (width >= 640) return 2; // sm
		return 1; // mobile
	});

	// Update column count based on viewport width
	useEffect(() => {
		if (typeof window === 'undefined') return;

		const updateColumnCount = () => {
			const width = window.innerWidth;
			if (width >= 1024)
				setColumnCount(4); // lg
			else if (width >= 768)
				setColumnCount(3); // md
			else if (width >= 640)
				setColumnCount(2); // sm
			else setColumnCount(1); // mobile
		};

		window.addEventListener('resize', updateColumnCount);
		return () => window.removeEventListener('resize', updateColumnCount);
	}, []);

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

	// Track the offset of the grid/table container from the top of the page
	useEffect(() => {
		if (gridParentRef.current && viewMode === 'grid') {
			gridParentOffsetRef.current = gridParentRef.current.offsetTop ?? 0;
		}
		if (tableParentRef.current && viewMode === 'table') {
			tableParentOffsetRef.current = tableParentRef.current.offsetTop ?? 0;
		}
	}, [viewMode]);

	// Ensure albums is an array before filtering
	const albumArray = Array.isArray(albums) ? albums : [];

	const filteredAlbums = useMemo(() => {
		return albumArray
			.filter((album) => {
				const searchLower = searchTerm.toLowerCase();
				return (
					album.title.toLowerCase().includes(searchLower) ||
					album.slug.toLowerCase().includes(searchLower) ||
					(album.description?.toLowerCase() || '').includes(searchLower)
				);
			})
			.sort((a, b) => {
				if (sortCriteria === 'title') {
					return sortDirection === 'asc'
						? a.title.localeCompare(b.title)
						: b.title.localeCompare(a.title);
				}
				if (sortCriteria === 'images') {
					return sortDirection === 'asc'
						? a.imageCount - b.imageCount
						: b.imageCount - a.imageCount;
				}
				return sortDirection === 'asc'
					? new Date(a.createdAt || 0).getTime() -
							new Date(b.createdAt || 0).getTime()
					: new Date(b.createdAt || 0).getTime() -
							new Date(a.createdAt || 0).getTime();
			});
	}, [albumArray, searchTerm, sortCriteria, sortDirection]);

	// Extract IDs of cover images that need signed URLs
	const coverImageIdsNeedingSigning = useMemo(() => {
		return filteredAlbums
			.filter(
				(
					album,
				): album is Album & { coverImage: NonNullable<Album['coverImage']> } =>
					!!album.coverImage?.requireSignedURLs,
			)
			.map((album) => album.coverImage.id);
	}, [filteredAlbums]);

	// Fetch signed URLs for cover images in batch
	const { data: coverSignedUrls } = useQuery({
		...trpc.cfImages.signedUrls.signBatch.queryOptions({
			imageIds: coverImageIdsNeedingSigning,
			variant: 'thumbsm',
			expirationSeconds: 3600,
		}),
		enabled: coverImageIdsNeedingSigning.length > 0,
	});

	// Create a lookup map for signed URLs
	const signedUrlMap = useMemo(() => {
		if (!coverSignedUrls) return new Map<string, string>();
		const map = new Map<string, string>();
		for (const img of coverSignedUrls.images) {
			map.set(img.imageId, img.url);
		}
		return map;
	}, [coverSignedUrls]);

	// Track settings save with debouncing
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Persist settings to localStorage with debouncing
	useEffect(() => {
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
		}

		saveTimeoutRef.current = setTimeout(() => {
			const settings: AlbumListSettings = {
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
	const deleteAlbumMutation = useMutation(
		trpc.cfImages.albums.deleteAlbum.mutationOptions({
			onSuccess: () => {
				toast.success('Album deleted successfully');
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'listAlbums']],
				});
			},
			onError: (error) => {
				toast.error(`Failed to delete album: ${error.message}`);
			},
		}),
	);

	// Publish / Unpublish / Archive mutations
	const publishAlbumMutation = useMutation(
		trpc.cfImages.albums.publishAlbum.mutationOptions({
			onSuccess: () => {
				toast.success('Album published');
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'listAlbums']],
				});
			},
			onError: (error) => {
				toast.error(`Failed to publish album: ${error.message}`);
			},
		}),
	);

	const unpublishAlbumMutation = useMutation(
		trpc.cfImages.albums.unpublishAlbum.mutationOptions({
			onSuccess: () => {
				toast.success('Album unpublished');
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'listAlbums']],
				});
			},
			onError: (error) => {
				toast.error(`Failed to unpublish album: ${error.message}`);
			},
		}),
	);

	const archiveAlbumMutation = useMutation(
		trpc.cfImages.albums.archiveAlbum.mutationOptions({
			onSuccess: () => {
				toast.success('Album archived');
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'listAlbums']],
				});
			},
			onError: (error) => {
				toast.error(`Failed to archive album: ${error.message}`);
			},
		}),
	);

	const toggleSortDirection = () => {
		setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
	};

	// Helper to get the correct cover image URL (signed or plain)
	const getCoverImageUrl = useCallback(
		(album: Album): string | null => {
			if (!album.coverImage) return null;
			if (album.coverImage.requireSignedURLs) {
				const signedUrl = signedUrlMap.get(album.coverImage.id);
				if (signedUrl) return signedUrl;
			}
			return getImageUrl(album.coverImage.deliveryUrl, 'thumbsm');
		},
		[signedUrlMap],
	);

	const handleDeleteRequest = useCallback((album: Album) => {
		setAlbumToDelete(album);
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
		if (albumToDelete) {
			await deleteAlbumMutation.mutateAsync({ id: albumToDelete.id });
			setAlbumToDelete(null);
		}
	};

	// Actions dropdown for an album
	const AlbumActions = useCallback(
		({ album }: { album: Album }) => (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon" className="h-8 w-8">
						<MoreHorizontal className="size-4" />
						<span className="sr-only">Open menu</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuLabel>Actions</DropdownMenuLabel>
					<DropdownMenuItem asChild>
						<Link
							to="/images/albums/$albumId"
							params={{ albumId: album.id }}
							className="flex cursor-pointer items-center px-2 py-1.5 text-sm"
						>
							<Pencil className="mr-2 size-4" />
							<span>Edit</span>
						</Link>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					{album.publishStatus !== 'published' && (
						<DropdownMenuItem
							onClick={() => publishAlbumMutation.mutate({ id: album.id })}
						>
							<Eye className="mr-2 size-4" />
							<span>Publish</span>
						</DropdownMenuItem>
					)}
					{album.publishStatus === 'published' && (
						<DropdownMenuItem
							onClick={() => unpublishAlbumMutation.mutate({ id: album.id })}
						>
							<EyeOff className="mr-2 size-4" />
							<span>Unpublish</span>
						</DropdownMenuItem>
					)}
					{album.publishStatus !== 'archived' && (
						<DropdownMenuItem
							onClick={() => archiveAlbumMutation.mutate({ id: album.id })}
						>
							<Archive className="mr-2 size-4" />
							<span>Archive</span>
						</DropdownMenuItem>
					)}
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={() => handleDeleteRequest(album)}>
						<Trash2 className="text-destructive-foreground mr-2 size-4" />
						<span className="text-destructive">Delete</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		),
		[
			publishAlbumMutation,
			unpublishAlbumMutation,
			archiveAlbumMutation,
			handleDeleteRequest,
		],
	);

	// Table columns definition
	const columns = useMemo<ColumnDef<Album>[]>(
		() => [
			{
				accessorKey: 'cover',
				header: '',
				size: 80,
				enableSorting: false,
				cell: ({ row }) => {
					const coverUrl = getCoverImageUrl(row.original);
					return (
						<div className="relative h-12 w-20 overflow-hidden rounded bg-muted">
							<Link
								to="/images/albums/$albumId"
								params={{ albumId: row.original.id }}
								className="block h-full w-full"
							>
								{coverUrl ? (
									<img
										src={coverUrl}
										alt={row.original.title}
										className="h-full w-full object-cover"
									/>
								) : (
									<div className="flex h-full w-full items-center justify-center">
										<FolderOpen className="text-muted-foreground size-5" />
									</div>
								)}
							</Link>
						</div>
					);
				},
			},
			{
				accessorKey: 'title',
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
						className="-ml-4"
					>
						Title
						<ArrowUpDown className="ml-2 h-4 w-4" />
					</Button>
				),
				cell: ({ row }) => (
					<Link
						to="/images/albums/$albumId"
						params={{ albumId: row.original.id }}
						className="font-medium hover:underline"
					>
						{row.original.title}
					</Link>
				),
			},
			{
				accessorKey: 'slug',
				header: 'Slug',
				cell: ({ row }) => (
					<span className="text-muted-foreground font-mono text-xs">
						{row.original.slug}
					</span>
				),
			},
			{
				accessorKey: 'imageCount',
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
						className="-ml-4"
					>
						Images
						<ArrowUpDown className="ml-2 h-4 w-4" />
					</Button>
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{row.original.imageCount}
					</span>
				),
			},
			{
				accessorKey: 'publishStatus',
				header: 'Status',
				cell: ({ row }) => getStatusBadge(row.original.publishStatus),
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
				cell: ({ row }) => <AlbumActions album={row.original} />,
			},
		],
		[getCoverImageUrl],
	);

	const table = useReactTable({
		data: filteredAlbums,
		columns,
		state: {
			sorting: tableSorting,
		},
		onSortingChange: handleSortingChange,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	// Grid virtualization - virtualize by rows, not individual items
	// columnCount is dynamically tracked based on viewport width
	const gridRowCount = Math.ceil(filteredAlbums.length / columnCount);
	const gridVirtualizer = useWindowVirtualizer({
		count: gridRowCount,
		estimateSize: () => 300, // Approximate row height
		overscan: 3,
		scrollMargin: gridParentOffsetRef.current,
	});

	// Virtualizer for table rows - uses window scroll
	const { rows } = table.getRowModel();
	const tableVirtualizer = useWindowVirtualizer({
		count: rows.length,
		estimateSize: () => 73, // Approximate row height
		overscan: 10,
		scrollMargin: tableParentOffsetRef.current,
	});

	return (
		<div className="space-y-4">
			<div className="flex justify-between gap-2">
				<Input
					placeholder="Search albums..."
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
									<SelectItem value="title">Sort by Title</SelectItem>
									<SelectItem value="images">Sort by Image Count</SelectItem>
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

			{/* Delete Confirmation Dialog */}
			<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Confirm Deletion</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete the album{' '}
							{albumToDelete ? (
								<span className="font-semibold">"{albumToDelete.title}"</span>
							) : (
								'this album'
							)}
							? This will remove the album but will not delete the images within
							it.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="secondary">Cancel</Button>
						</DialogClose>
						<Button variant="destructive" onClick={handleDeleteConfirm}>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Table View */}
			{viewMode === 'table' && (
				<div ref={tableParentRef} className="rounded-md border">
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
							{rows.length ? (
								<>
									{/* Virtual padding row at top */}
									{tableVirtualizer.getVirtualItems().length > 0 && (
										<tr
											style={{
												height: `${(tableVirtualizer.getVirtualItems()[0]?.start ?? 0) - tableVirtualizer.options.scrollMargin}px`,
											}}
										/>
									)}
									{tableVirtualizer.getVirtualItems().map((virtualRow) => {
										const row = rows[virtualRow.index];
										return (
											<TableRow
												key={row.id}
												data-index={virtualRow.index}
												ref={tableVirtualizer.measureElement}
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
										);
									})}
									{/* Virtual padding row at bottom */}
									{tableVirtualizer.getVirtualItems().length > 0 && (
										<tr
											style={{
												height: `${
													tableVirtualizer.getTotalSize() -
													(tableVirtualizer.getVirtualItems()[
														tableVirtualizer.getVirtualItems().length - 1
													]?.end ?? 0)
												}px`,
											}}
										/>
									)}
								</>
							) : (
								<TableRow>
									<TableCell
										colSpan={columns.length}
										className="h-24 text-center"
									>
										No albums found.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			)}

			{/* Grid View */}
			{viewMode === 'grid' && (
				<div ref={gridParentRef}>
					<div
						style={{
							height: `${gridVirtualizer.getTotalSize()}px`,
							width: '100%',
							position: 'relative',
						}}
					>
						<div
							style={{
								position: 'absolute',
								top: 0,
								left: 0,
								width: '100%',
								transform: `translateY(${(gridVirtualizer.getVirtualItems()[0]?.start ?? 0) - gridParentOffsetRef.current}px)`,
							}}
						>
							{gridVirtualizer.getVirtualItems().map((virtualRow) => {
								// Get all albums for this row
								const startIdx = virtualRow.index * columnCount;
								const rowAlbums = filteredAlbums.slice(
									startIdx,
									startIdx + columnCount,
								);
								return (
									<div
										key={virtualRow.index}
										data-index={virtualRow.index}
										ref={gridVirtualizer.measureElement}
										className="grid gap-4 pb-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
									>
										{rowAlbums.map((album) => {
											const coverUrl = getCoverImageUrl(album);
											return (
												<Card
													key={album.id}
													className="gap-2 overflow-hidden pt-0 pb-2"
												>
													<div className="relative aspect-3/2 overflow-hidden bg-muted">
														<Link
															to="/images/albums/$albumId"
															params={{ albumId: album.id }}
															className="block size-full"
														>
															{coverUrl ? (
																<img
																	src={coverUrl}
																	alt={album.title}
																	className="size-full object-cover transition-transform hover:scale-105"
																/>
															) : (
																<div className="flex size-full items-center justify-center">
																	<FolderOpen className="text-muted-foreground size-10" />
																</div>
															)}
														</Link>
														<div className="absolute top-2 right-2">
															{getStatusBadge(album.publishStatus)}
														</div>
													</div>
													<CardHeader className="p-4 pt-2">
														<div className="flex items-start justify-between">
															<Link
																to="/images/albums/$albumId"
																params={{ albumId: album.id }}
																className="cursor-pointer"
															>
																<CardTitle className="line-clamp-1 text-sm">
																	{album.title}
																</CardTitle>
															</Link>
															<AlbumActions album={album} />
														</div>
														<CardDescription className="line-clamp-2 text-xs">
															{album.description || 'No description'}
														</CardDescription>
													</CardHeader>
													<CardFooter className="text-muted-foreground flex items-center justify-between p-4 pt-0 text-xs">
														<span className="flex items-center gap-1">
															<ImageIcon className="size-3" />
															{album.imageCount}{' '}
															{album.imageCount === 1 ? 'image' : 'images'}
														</span>
														<span>{formatDate(album.createdAt)}</span>
													</CardFooter>
												</Card>
											);
										})}
									</div>
								);
							})}
						</div>
					</div>
				</div>
			)}

			{/* Empty State */}
			{filteredAlbums.length === 0 && viewMode === 'grid' && (
				<div className="flex flex-col items-center justify-center py-12 text-center">
					<FolderOpen className="text-muted-foreground mb-4 h-12 w-12" />
					<h3 className="text-lg font-medium">No albums found</h3>
					<p className="text-muted-foreground">
						{searchTerm
							? 'Try a different search term'
							: 'Create your first album to organize your images'}
					</p>
				</div>
			)}

			{/* Pagination Controls */}
			{totalPages > 1 && (
				<div className="flex items-center justify-between border-t pt-4">
					<p className="text-muted-foreground text-sm">
						Showing {(currentPage - 1) * 25 + 1} to{' '}
						{Math.min(currentPage * 25, total)} of {total} albums
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
