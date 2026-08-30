import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
	type ColumnDef,
	createSortedRowModel,
	flexRender,
	rowSortingFeature,
	type SortingState,
	sortFn_alphanumeric,
	sortFn_basic,
	sortFn_datetime,
	sortFn_text,
	tableFeatures,
	useTable,
} from '@tanstack/react-table';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import {
	AlertCircle,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	CheckCircle,
	Copy,
	Eye,
	Film,
	Grid3X3,
	List,
	Loader2,
	MoreHorizontal,
	Pencil,
	Play,
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
import { VideoThumbnail } from '@/components/VideoThumbnail';
import { trpc } from '@/lib/trpc';
import type { Video } from '@/lib/types';
import { formatDate, formatDuration } from '@/lib/video-helpers';
import { VideoDelete } from './VideoDelete';
import { VideoDialog } from './VideoDialog';

interface VideoListProps {
	videos: Video[] | null | undefined;
	libraryId: string;
	/** Whether more pages are available for infinite scroll */
	hasNextPage?: boolean;
	/** Loads the next page of videos */
	fetchNextPage?: () => void;
	/** True while the next page is being fetched */
	isFetchingNextPage?: boolean;
}

type ViewMode = 'grid' | 'table';

const STORAGE_KEY = 'videoList-settings';

// Batch procedures accept at most 100 items server-side; chunk client-side so
// requests stay well under that limit even as libraries grow.
const BATCH_CHUNK_SIZE = 50;

function chunkArray<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size));
	}
	return chunks;
}

// Map library IDs to their types
const LIBRARY_TYPE_MAP: Record<string, 'premium' | 'basic'> = {
	WM2OkZia: 'premium',
	pnr6CRTe: 'basic',
};

// Get library type from library ID
function getLibraryType(libraryId: string): 'premium' | 'basic' {
	return LIBRARY_TYPE_MAP[libraryId] || 'premium'; // Default to 'premium' if not found
}

// Generate the video URL for the frontend
function generateVideoUrl(
	libraryId: string,
	videoId: string,
	title: string,
): string {
	const libraryType = getLibraryType(libraryId);
	const encodedTitle = encodeURIComponent(title);
	return `https://www.airwartrail.com/watch/${libraryType}/${libraryId}/video/${videoId}?title=${encodedTitle}`;
}

interface VideoListSettings {
	viewMode: ViewMode;
	sortCriteria: string;
	sortDirection: string;
	tableSorting: SortingState;
}

function getStoredSettings(): VideoListSettings {
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

// Read stored settings once at module level to avoid multiple reads
const initialSettings = getStoredSettings();

const features = tableFeatures({
	rowSortingFeature,
	sortedRowModel: createSortedRowModel(),
	sortFns: {
		alphanumeric: sortFn_alphanumeric,
		basic: sortFn_basic,
		datetime: sortFn_datetime,
		text: sortFn_text,
	},
});

export function VideoList({
	videos = [],
	libraryId,
	hasNextPage = false,
	fetchNextPage,
	isFetchingNextPage = false,
}: VideoListProps) {
	const queryClient = useQueryClient();
	const [searchTerm, setSearchTerm] = useState('');
	const [filterStatus, setFilterStatus] = useState<
		'all' | 'published' | 'unpublished'
	>('all');
	const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);

	// Refs for virtualization
	const gridParentRef = useRef<HTMLDivElement>(null);
	const tableParentRef = useRef<HTMLDivElement>(null);
	const gridParentOffsetRef = useRef(0);
	const tableParentOffsetRef = useRef(0);

	// Sentinel at the end of the list - when it scrolls into view, load the
	// next page of videos (infinite scroll)
	const endSentinelRef = useRef<HTMLDivElement>(null);

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

	// Initialize state from stored settings (read once)
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

	// Use ref to track if we need to save (debounced)
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Track the offset of the grid/table container from the top of the page
	useEffect(() => {
		if (gridParentRef.current && viewMode === 'grid') {
			gridParentOffsetRef.current = gridParentRef.current.offsetTop ?? 0;
		}
		if (tableParentRef.current && viewMode === 'table') {
			tableParentOffsetRef.current = tableParentRef.current.offsetTop ?? 0;
		}
	}, [viewMode]);

	// Infinite scroll: when the end sentinel scrolls into view, load the next
	// page of videos. `isFetchingNextPage` guards against overlapping fetches.
	useEffect(() => {
		const el = endSentinelRef.current;
		if (!el || !hasNextPage || !fetchNextPage) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting && !isFetchingNextPage) {
					fetchNextPage();
				}
			},
			{ rootMargin: '400px 0px' },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [hasNextPage, fetchNextPage, isFetchingNextPage]);

	// Persist settings to localStorage with debouncing
	useEffect(() => {
		// Clear any pending save
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
		}

		// Debounce the save to prevent rapid writes
		saveTimeoutRef.current = setTimeout(() => {
			const settings: VideoListSettings = {
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

	// Delete mutation using tRPC with internal video ID
	const deleteVideoMutation = useMutation(
		trpc.mux.deleteVideoById.mutationOptions({
			onSuccess: () => {
				toast.success('Video deleted successfully');
				// Invalidate the videos query to refetch from database
				queryClient.invalidateQueries({
					queryKey: [['mux', 'listVideosFromDatabase']],
				});
			},
			onError: (error) => {
				toast.error(`Failed to delete video: ${error.message}`);
			},
		}),
	);

	// Ensure videos is an array before filtering
	const videoArray = Array.isArray(videos) ? videos : [];

	const filteredVideos = useMemo(() => {
		return videoArray
			.filter((video) => {
				// Filter by search term
				const matchesSearch = video.title
					.toLowerCase()
					.includes(searchTerm.toLowerCase());
				// Filter by published status
				const matchesStatus =
					filterStatus === 'all' ||
					(filterStatus === 'published' && video.isPublished) ||
					(filterStatus === 'unpublished' && !video.isPublished);
				return matchesSearch && matchesStatus;
			})
			.sort((a, b) => {
				if (sortCriteria === 'title') {
					return sortDirection === 'asc'
						? a.title.localeCompare(b.title)
						: b.title.localeCompare(a.title);
				} else if (sortCriteria === 'scheduledRelease') {
					const aDate = a.scheduledReleaseDate
						? new Date(a.scheduledReleaseDate).getTime()
						: 0;
					const bDate = b.scheduledReleaseDate
						? new Date(b.scheduledReleaseDate).getTime()
						: 0;
					return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
				} else {
					return sortDirection === 'asc'
						? new Date(a.dateUploaded || 0).getTime() -
								new Date(b.dateUploaded || 0).getTime()
						: new Date(b.dateUploaded || 0).getTime() -
								new Date(a.dateUploaded || 0).getTime();
				}
			});
	}, [videoArray, searchTerm, filterStatus, sortCriteria, sortDirection]);

	// Extract video IDs for batch thumbnail query
	const videoIds = useMemo(
		() => filteredVideos.map((v) => v.id),
		[filteredVideos],
	);

	// Extract playback items for batch signed token query
	const playbackItems = useMemo(
		() =>
			filteredVideos
				.filter((v) => v.playbackId) // Only videos with playback IDs
				.map((v) => ({
					playbackId: v.playbackId as string,
					expiresIn: 3600,
				})),
		[filteredVideos],
	);

	// Batch fetch custom thumbnails for all videos (chunked to respect server limits)
	const thumbnailChunks = useMemo(
		() => chunkArray(videoIds, BATCH_CHUNK_SIZE),
		[videoIds],
	);
	const { data: thumbnailBatch, isLoading: isThumbnailBatchLoading } =
		useQueries({
			queries: thumbnailChunks.map((chunk) =>
				trpc.mux.getThumbnailBatch.queryOptions({
					videoIds: chunk,
					libraryId,
				}),
			),
			combine: (results) => ({
				data: results.flatMap((r) => r.data ?? []),
				isLoading: results.some((r) => r.isLoading),
			}),
		});

	// Batch fetch signed tokens for all videos with playback IDs (chunked)
	const playbackChunks = useMemo(
		() => chunkArray(playbackItems, BATCH_CHUNK_SIZE),
		[playbackItems],
	);
	const { data: signedTokensBatch, isLoading: isSignedTokensBatchLoading } =
		useQueries({
			queries: playbackChunks.map((chunk) =>
				trpc.mux.generateSignedTokensBatch.queryOptions({
					items: chunk,
					libraryId,
				}),
			),
			combine: (results) => ({
				data: results.flatMap((r) => r.data ?? []),
				isLoading: results.some((r) => r.isLoading),
			}),
		});

	// Create lookup maps for O(1) access in render
	const thumbnailMap = useMemo(() => {
		if (!thumbnailBatch) return new Map();
		return new Map(thumbnailBatch.map((item) => [item.videoId, item]));
	}, [thumbnailBatch]);

	const signedTokensMap = useMemo(() => {
		if (!signedTokensBatch) return new Map();
		return new Map(signedTokensBatch.map((item) => [item.playbackId, item]));
	}, [signedTokensBatch]);

	const toggleSortDirection = () => {
		setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
	};

	const handleDeleteRequest = useCallback((video: Video) => {
		setVideoToDelete(video);
		setIsDeleteDialogOpen(true);
	}, []);

	const handleSelectVideo = useCallback((video: Video) => {
		setSelectedVideo(video);
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
		if (videoToDelete) {
			await deleteVideoMutation.mutateAsync({
				videoId: videoToDelete.id,
				libraryId,
			});
			setVideoToDelete(null);
		}
	};

	// Table columns definition
	const columns = useMemo<ColumnDef<typeof features, Video>[]>(
		() => [
			{
				accessorKey: 'thumbnail',
				header: '',
				size: 80,
				enableSorting: false,
				cell: ({ row }) => (
					<div className="relative h-12 w-20 overflow-hidden rounded">
						<Link
							to="/library/$libraryId/edit-video/$videoId"
							params={{ videoId: row.original.id, libraryId }}
							className="font-medium hover:underline"
						>
							<VideoThumbnail
								playbackId={row.original.playbackId}
								videoId={row.original.id}
								alt={row.original.title}
								className="h-full w-full object-cover"
								width={160}
								height={90}
								policy={row.original.policy ?? undefined}
								libraryId={libraryId}
								batchThumbnailData={thumbnailMap.get(row.original.id)}
								batchThumbnailPending={isThumbnailBatchLoading}
								batchSignedTokens={
									row.original.playbackId
										? signedTokensMap.get(row.original.playbackId)
										: undefined
								}
								batchSignedTokensPending={isSignedTokensBatchLoading}
							/>
						</Link>
					</div>
				),
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
						to="/library/$libraryId/edit-video/$videoId"
						params={{ videoId: row.original.id, libraryId }}
						className="font-medium hover:underline"
					>
						{row.original.title}
					</Link>
				),
			},
			{
				accessorKey: 'duration',
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
						className="-ml-4"
					>
						Duration
						<ArrowUpDown className="ml-2 h-4 w-4" />
					</Button>
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{formatDuration(row.original.duration)}
					</span>
				),
			},
			{
				accessorKey: 'status',
				header: 'Status',
				cell: ({ row }) => {
					const status = row.original.status;
					return (
						<Badge
							variant={
								status === 'ready'
									? 'default'
									: status === 'errored'
										? 'destructive'
										: 'secondary'
							}
							className="gap-1"
						>
							{status === 'ready' && <CheckCircle className="size-3" />}
							{status === 'errored' && <AlertCircle className="size-3" />}
							{status === 'preparing' && (
								<Loader2 className="size-3 animate-spin" />
							)}
							{status === 'ready'
								? 'Ready'
								: status === 'errored'
									? 'Error'
									: 'Processing'}
						</Badge>
					);
				},
			},
			{
				accessorKey: 'isPublished',
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
						className="-ml-4"
					>
						Visibility
						<ArrowUpDown className="ml-2 h-4 w-4" />
					</Button>
				),
				cell: ({ row }) => (
					<Badge variant={row.original.isPublished ? 'default' : 'secondary'}>
						{row.original.isPublished ? 'Published' : 'Unpublished'}
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
				accessorKey: 'scheduledReleaseDate',
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
						className="-ml-4"
					>
						Scheduled
						<ArrowUpDown className="ml-2 h-4 w-4" />
					</Button>
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground text-sm">
						{row.original.scheduledReleaseDate
							? formatDate(row.original.scheduledReleaseDate)
							: '-'}
					</span>
				),
			},
			{
				id: 'actions',
				header: '',
				size: 50,
				enableSorting: false,
				cell: ({ row }) => {
					const video = row.original;
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
								<DropdownMenuItem
									onClick={() => {
										const url = generateVideoUrl(
											libraryId,
											video.id,
											video.title,
										);
										navigator.clipboard.writeText(url).then(() => {
											toast.success('Video URL copied to clipboard');
										});
									}}
								>
									<Copy className="mr-2 size-4" />
									<span>Copy URL</span>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => handleSelectVideo(video)}>
									<Eye className="mr-2 size-4" />
									<span>Preview</span>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link
										to="/library/$libraryId/edit-video/$videoId"
										params={{ videoId: video.id, libraryId }}
										className="flex cursor-pointer items-center px-2 py-1.5 text-sm"
									>
										<Pencil className="mr-2 size-4" />
										<span>Edit</span>
									</Link>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => handleDeleteRequest(video)}>
									<Trash2 className="text-destructive-foreground mr-2 size-4" />
									<span className="text-destructive">Delete</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					);
				},
			},
		],
		[
			handleDeleteRequest,
			handleSelectVideo,
			libraryId,
			thumbnailMap,
			signedTokensMap,
			isThumbnailBatchLoading,
			isSignedTokensBatchLoading,
		],
	);

	const table = useTable({
		data: filteredVideos,
		columns,
		features,
		state: {
			sorting: tableSorting,
		},
		onSortingChange: handleSortingChange,
	});

	// Grid virtualization - virtualize by rows, not individual items
	// columnCount is dynamically tracked based on viewport width
	const gridRowCount = Math.ceil(filteredVideos.length / columnCount);
	const gridVirtualizer = useWindowVirtualizer({
		count: gridRowCount,
		estimateSize: () => 380, // Approximate row height
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
				<div className="flex gap-2">
					<Input
						placeholder="Search videos..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="max-w-sm"
					/>
				</div>
				<div className="flex gap-x-2">
					<Select
						value={filterStatus}
						onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
					>
						<SelectTrigger className="w-fit">
							<SelectValue placeholder="Filter by" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">View All Videos</SelectItem>
							<SelectItem value="published">Published</SelectItem>
							<SelectItem value="unpublished">Unpublished</SelectItem>
						</SelectContent>
					</Select>

					{viewMode === 'grid' && (
						<>
							<Select value={sortCriteria} onValueChange={setSortCriteria}>
								<SelectTrigger className="max-w-sm">
									<SelectValue placeholder="Sort by" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="date">Sort by Date</SelectItem>
									<SelectItem value="scheduledRelease">
										Sort by Scheduled
									</SelectItem>
									<SelectItem value="title">Sort by Title</SelectItem>
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

			{selectedVideo && (
				<VideoDialog
					video={selectedVideo}
					libraryId={libraryId}
					open={!!selectedVideo}
					onOpenChange={() => {
						setSelectedVideo(null);
						setIsEditing(false);
					}}
					isEditing={isEditing}
				/>
			)}

			<VideoDelete
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
				onConfirm={handleDeleteConfirm}
			/>

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
												{row.getAllCells().map((cell) => (
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
										No videos found.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			)}

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
								// Get all videos for this row
								const startIdx = virtualRow.index * columnCount;
								const rowVideos = filteredVideos.slice(
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
										{rowVideos.map((video) => (
											<Card
												key={video.id}
												className="gap-2 overflow-hidden pt-0 pb-2"
											>
												<div className="relative">
													<VideoThumbnail
														playbackId={video.playbackId}
														videoId={video.id}
														alt={video.title}
														className="aspect-video w-full object-cover"
														aspectVideo
														policy={video.policy ?? undefined}
														libraryId={libraryId}
														batchThumbnailData={thumbnailMap.get(video.id)}
														batchThumbnailPending={isThumbnailBatchLoading}
														batchSignedTokens={
															video.playbackId
																? signedTokensMap.get(video.playbackId)
																: undefined
														}
														batchSignedTokensPending={
															isSignedTokensBatchLoading
														}
													/>
													<div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100">
														<Button
															variant="secondary"
															size="icon"
															onClick={() => setSelectedVideo(video)}
														>
															<Play className="h-6 w-6" />
														</Button>
													</div>
													<div className="absolute right-2 bottom-2 rounded bg-black/70 px-1 text-xs text-white">
														{formatDuration(video.duration)}
													</div>
												</div>
												<CardHeader className="p-4">
													<div className="flex items-start justify-between">
														<Link
															to="/library/$libraryId/edit-video/$videoId"
															params={{ videoId: video.id, libraryId }}
															className="cursor-pointer"
														>
															<CardTitle className="text-base text-wrap">
																{video.title}
															</CardTitle>
														</Link>
														<DropdownMenu>
															<DropdownMenuTrigger asChild>
																<Button
																	variant="secondary"
																	size="icon"
																	className="h-8 w-8"
																>
																	<MoreHorizontal className="size-4" />
																	<span className="sr-only">Open menu</span>
																</Button>
															</DropdownMenuTrigger>
															<DropdownMenuContent align="end">
																<DropdownMenuLabel>Actions</DropdownMenuLabel>
																<DropdownMenuItem
																	onClick={() => {
																		const url = generateVideoUrl(
																			libraryId,
																			video.id,
																			video.title,
																		);
																		navigator.clipboard
																			.writeText(url)
																			.then(() => {
																				toast.success(
																					'Video URL copied to clipboard',
																				);
																			});
																	}}
																>
																	<Copy className="mr-2 size-4" />
																	<span>Copy URL</span>
																</DropdownMenuItem>
																<DropdownMenuSeparator />
																<DropdownMenuItem
																	onClick={() => setSelectedVideo(video)}
																>
																	<Eye className="mr-2 size-4" />
																	<span>Preview</span>
																</DropdownMenuItem>
																<DropdownMenuItem asChild>
																	<Link
																		to="/library/$libraryId/edit-video/$videoId"
																		params={{ videoId: video.id, libraryId }}
																		className="flex cursor-pointer items-center px-2 py-1.5 text-sm"
																	>
																		<Pencil className="mr-2 size-4" />
																		<span>Edit</span>
																	</Link>
																</DropdownMenuItem>
																<DropdownMenuSeparator />
																<DropdownMenuItem
																	onClick={() => handleDeleteRequest(video)}
																>
																	<Trash2 className="text-destructive-foreground mr-2 size-4" />
																	<span className="text-destructive">
																		Delete
																	</span>
																</DropdownMenuItem>
															</DropdownMenuContent>
														</DropdownMenu>
													</div>
													<CardDescription>
														<div className="space-y-2">
															<div>
																Status:{' '}
																<Badge
																	variant={
																		video.status === 'ready'
																			? 'default'
																			: video.status === 'errored'
																				? 'destructive'
																				: 'secondary'
																	}
																	className="gap-1"
																>
																	{video.status === 'ready' && (
																		<CheckCircle className="size-3" />
																	)}
																	{video.status === 'errored' && (
																		<AlertCircle className="size-3" />
																	)}
																	{video.status === 'preparing' && (
																		<Loader2 className="size-3 animate-spin" />
																	)}
																	{video.status === 'ready'
																		? 'Ready'
																		: video.status === 'errored'
																			? 'Error'
																			: 'Processing'}
																</Badge>
															</div>
															<div>
																Views:{' '}
																<span className="font-semibold text-primary">
																	{(video.views ?? 0).toLocaleString()}
																</span>
															</div>
															<div>
																Visibility:{' '}
																<span className="font-semibold text-primary">
																	{video.isPublished
																		? 'Published'
																		: 'Unpublished'}
																</span>
															</div>
														</div>
													</CardDescription>
												</CardHeader>
												<CardFooter className="text-muted-foreground p-4 pt-0 text-xs">
													<div className="flex flex-col gap-1">
														<span>
															Uploaded on {formatDate(video.createdAt)}
														</span>
														{video.scheduledReleaseDate && (
															<span className="text-primary">
																Scheduled:{' '}
																{formatDate(video.scheduledReleaseDate)}
															</span>
														)}
													</div>
												</CardFooter>
											</Card>
										))}
									</div>
								);
							})}
						</div>
					</div>
				</div>
			)}

			{filteredVideos.length === 0 && viewMode === 'grid' && (
				<div className="flex flex-col items-center justify-center py-12 text-center">
					<Film className="text-muted-foreground mb-4 h-12 w-12" />
					<h3 className="text-lg font-medium">No videos found</h3>
					<p className="text-muted-foreground">
						{searchTerm
							? 'Try a different search term'
							: 'Upload your first video to get started'}
					</p>
				</div>
			)}

			{hasNextPage && (
				<div ref={endSentinelRef} className="flex justify-center py-4">
					{isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
				</div>
			)}
		</div>
	);
}
