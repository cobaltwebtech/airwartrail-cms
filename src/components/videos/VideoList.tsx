import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { copyVideoUrl, formatDate, formatDuration } from '@/lib/video-helpers';
import { VideoDelete } from './VideoDelete';
import { VideoDialog } from './VideoDialog';

interface VideoListProps {
	videos: Video[] | null | undefined;
	libraryId: string;
}

type ViewMode = 'grid' | 'table';

const STORAGE_KEY = 'videoList-settings';

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

export function VideoList({ videos = [], libraryId }: VideoListProps) {
	const queryClient = useQueryClient();
	const [searchTerm, setSearchTerm] = useState('');
	const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);

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
			.filter((video) =>
				video.title.toLowerCase().includes(searchTerm.toLowerCase()),
			)
			.sort((a, b) => {
				if (sortCriteria === 'title') {
					return sortDirection === 'asc'
						? a.title.localeCompare(b.title)
						: b.title.localeCompare(a.title);
				} else {
					return sortDirection === 'asc'
						? new Date(a.dateUploaded || 0).getTime() -
								new Date(b.dateUploaded || 0).getTime()
						: new Date(b.dateUploaded || 0).getTime() -
								new Date(a.dateUploaded || 0).getTime();
				}
			});
	}, [videoArray, searchTerm, sortCriteria, sortDirection]);

	const toggleSortDirection = () => {
		setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
	};

	const handleCopy = useCallback((video: Video) => {
		copyVideoUrl(video.guid || video.id)();
		toast.success('URL copied to clipboard');
	}, []);

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
	const columns = useMemo<ColumnDef<Video>[]>(
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
								alt={row.original.title}
								className="h-full w-full object-cover"
								width={160}
								height={90}
								policy={row.original.policy ?? undefined}
								libraryId={libraryId}
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
				accessorKey: 'views',
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
						className="-ml-4"
					>
						Views
						<ArrowUpDown className="ml-2 h-4 w-4" />
					</Button>
				),
				cell: ({ row }) => (
					<Badge variant="secondary">
						{row.original.views?.toLocaleString() ?? 0}
					</Badge>
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
				header: 'Visibility',
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
								<DropdownMenuItem onClick={() => handleSelectVideo(video)}>
									<Eye className="mr-2 size-4" />
									<span>Preview</span>
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => handleCopy(video)}>
									<Copy className="mr-2 size-4" />
									<span>Copy URL</span>
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
		[handleCopy, handleDeleteRequest, handleSelectVideo, libraryId],
	);

	const table = useReactTable({
		data: filteredVideos,
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
					placeholder="Search videos..."
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
										No videos found.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			)}

			{viewMode === 'grid' && (
				<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
					{filteredVideos.map((video) => (
						<Card key={video.id} className="gap-2 overflow-hidden pt-0 pb-2">
							<div className="relative">
								<VideoThumbnail
									playbackId={video.playbackId}
									alt={video.title}
									className="aspect-video w-full object-cover"
									aspectVideo
									policy={video.policy ?? undefined}
									libraryId={libraryId}
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
											<Button variant="ghost" size="icon" className="h-8 w-8">
												<MoreHorizontal className="size-4" />
												<span className="sr-only">Open menu</span>
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuLabel>Actions</DropdownMenuLabel>
											<DropdownMenuItem onClick={() => setSelectedVideo(video)}>
												<Eye className="mr-2 size-4" />
												<span>Preview</span>
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => handleCopy(video)}>
												<Copy className="mr-2 size-4" />
												<span>Copy URL</span>
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
												<span className="text-destructive">Delete</span>
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
								<CardDescription>
									<div className="space-y-1">
										<div>
											{' '}
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
											{' '}
											Views:{' '}
											<Badge variant="secondary">
												{(video.views ?? 0).toLocaleString()}
											</Badge>
										</div>
										<div>
											Visibility:{' '}
											<Badge
												variant={video.isPublished ? 'default' : 'secondary'}
											>
												{video.isPublished ? 'Published' : 'Unpublished'}
											</Badge>
										</div>
									</div>
								</CardDescription>
							</CardHeader>
							<CardFooter className="text-muted-foreground p-4 pt-0 text-xs">
								Uploaded on {formatDate(video.createdAt)}
							</CardFooter>
						</Card>
					))}
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
		</div>
	);
}
