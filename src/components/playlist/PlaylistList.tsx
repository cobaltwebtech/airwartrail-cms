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
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	Eye,
	EyeOff,
	Film,
	Grid3X3,
	List,
	ListVideo,
	MoreHorizontal,
	Pencil,
	Trash2,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
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
import {
	getPlaylistCategoryLabel,
	type PlaybackPolicy,
	type PlaylistCategory,
} from '@/lib/constants';
import { trpc } from '@/lib/trpc';
import { formatDate } from '@/lib/video-helpers';
import { PlaylistDelete } from './PlaylistDelete';

// Type for playlist from the API
// Note: tags comes from API as a JSON string (stored as text in DB)
export interface Playlist {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	category: PlaylistCategory;
	thumbnailVideoId: string | null;
	thumbnailTime: number | null;
	isPublished: boolean;
	publishedAt: Date | null;
	sortOrder: number;
	tags: string | null;
	customMetadata: Record<string, unknown> | null;
	createdAt: Date;
	updatedAt: Date;
	videoCount: number;
	thumbnailPlaybackId: string | null | undefined;
	thumbnailPolicy: PlaybackPolicy | null;
}

// Helper to parse tags from JSON string
function parseTags(tags: string | null): string[] {
	if (!tags) return [];
	try {
		const parsed = JSON.parse(tags);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

interface PlaylistListProps {
	playlists: Playlist[] | null | undefined;
	libraryId: string;
}

type ViewMode = 'grid' | 'table';

const STORAGE_KEY = 'playlistList-settings';

interface PlaylistListSettings {
	viewMode: ViewMode;
	sortCriteria: string;
	sortDirection: string;
	tableSorting: SortingState;
}

function getStoredSettings(): PlaylistListSettings {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			return {
				viewMode: parsed.viewMode ?? 'grid',
				sortCriteria: parsed.sortCriteria ?? 'sortOrder',
				sortDirection: parsed.sortDirection ?? 'asc',
				tableSorting: parsed.tableSorting ?? [],
			};
		}
	} catch {
		// Ignore parse errors
	}
	return {
		viewMode: 'grid',
		sortCriteria: 'sortOrder',
		sortDirection: 'asc',
		tableSorting: [],
	};
}

const initialSettings = getStoredSettings();

export function PlaylistList({ playlists = [], libraryId }: PlaylistListProps) {
	const queryClient = useQueryClient();
	const [searchTerm, setSearchTerm] = useState('');
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(
		null,
	);

	// Initialize state from stored settings
	const [sortCriteria, setSortCriteria] = useState(
		initialSettings.sortCriteria,
	);
	const [sortDirection, setSortDirection] = useState(
		initialSettings.sortDirection,
	);
	const [viewMode, setViewMode] = useState<ViewMode>(initialSettings.viewMode);
	const [sorting, setSorting] = useState<SortingState>(
		initialSettings.tableSorting,
	);

	// Save settings to localStorage
	const saveSettings = (settings: Partial<PlaylistListSettings>) => {
		try {
			const current = getStoredSettings();
			const updated = { ...current, ...settings };
			localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
		} catch {
			// Ignore storage errors
		}
	};

	// Toggle publish status mutation
	const togglePublishMutation = useMutation(
		trpc.mux.setPlaylistPublishStatus.mutationOptions({
			onSuccess: (_, variables) => {
				toast.success(
					variables.isPublished ? 'Playlist published' : 'Playlist unpublished',
				);
				queryClient.invalidateQueries({
					queryKey: trpc.mux.listPlaylists.queryKey({ libraryId }),
				});
			},
			onError: (error) => {
				toast.error(`Failed to update publish status: ${error.message}`);
			},
		}),
	);

	// Filter and sort playlists
	const filteredPlaylists = useMemo(() => {
		let result = [...(playlists ?? [])];

		// Apply search filter
		if (searchTerm) {
			const term = searchTerm.toLowerCase();
			result = result.filter(
				(playlist) =>
					playlist.name.toLowerCase().includes(term) ||
					playlist.slug.toLowerCase().includes(term) ||
					playlist.description?.toLowerCase().includes(term) ||
					parseTags(playlist.tags).some((tag) =>
						tag.toLowerCase().includes(term),
					),
			);
		}

		// Apply sorting (for grid view)
		result.sort((a, b) => {
			let comparison = 0;
			switch (sortCriteria) {
				case 'name':
					comparison = a.name.localeCompare(b.name);
					break;
				case 'date':
					comparison =
						new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
					break;
				case 'videoCount':
					comparison = a.videoCount - b.videoCount;
					break;
				case 'sortOrder':
					comparison = a.sortOrder - b.sortOrder;
					break;
				default:
					// No default action needed; fall back to sortOrder
					comparison = a.sortOrder - b.sortOrder;
					break;
			}
			return sortDirection === 'asc' ? comparison : -comparison;
		});

		return result;
	}, [playlists, searchTerm, sortCriteria, sortDirection]);

	const handleDeleteClick = useCallback((playlist: Playlist) => {
		setPlaylistToDelete(playlist);
		setIsDeleteDialogOpen(true);
	}, []);

	const handleTogglePublish = useCallback(
		(playlist: Playlist) => {
			togglePublishMutation.mutate({
				playlistId: playlist.id,
				libraryId,
				isPublished: !playlist.isPublished,
			});
		},
		[togglePublishMutation, libraryId],
	);

	// Table columns
	const columns: ColumnDef<Playlist>[] = useMemo(
		() => [
			{
				accessorKey: 'thumbnail',
				header: '',
				size: 80,
				enableSorting: false,
				cell: ({ row }) => (
					<div className="w-20 h-12 rounded overflow-hidden">
						<VideoThumbnail
							playbackId={row.original.thumbnailPlaybackId}
							alt={row.original.name}
							className="w-full h-full object-cover"
							time={row.original.thumbnailTime ?? 3}
							policy={row.original.thumbnailPolicy ?? undefined}
							libraryId={libraryId}
							fallbackIcon={
								<ListVideo className="h-8 w-8 text-muted-foreground" />
							}
						/>
					</div>
				),
			},
			{
				accessorKey: 'name',
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
					>
						Name
						{column.getIsSorted() === 'asc' ? (
							<ArrowUp className="ml-2 h-4 w-4" />
						) : column.getIsSorted() === 'desc' ? (
							<ArrowDown className="ml-2 h-4 w-4" />
						) : (
							<ArrowUpDown className="ml-2 h-4 w-4" />
						)}
					</Button>
				),
				cell: ({ row }) => (
					<div>
						<Link
							to="/library/$libraryId/playlist/$playlistId"
							params={{ libraryId, playlistId: row.original.id }}
							className="font-medium hover:underline"
						>
							{row.original.name}
						</Link>
						<p className="text-xs text-muted-foreground">
							/{row.original.slug}
						</p>
					</div>
				),
			},
			{
				accessorKey: 'category',
				header: 'Category',
				cell: ({ row }) => (
					<p>{getPlaylistCategoryLabel(row.original.category)}</p>
				),
			},
			{
				accessorKey: 'videoCount',
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
					>
						Videos
						{column.getIsSorted() === 'asc' ? (
							<ArrowUp className="ml-2 h-4 w-4" />
						) : column.getIsSorted() === 'desc' ? (
							<ArrowDown className="ml-2 h-4 w-4" />
						) : (
							<ArrowUpDown className="ml-2 h-4 w-4" />
						)}
					</Button>
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-1">
						<Film className="h-4 w-4 text-muted-foreground" />
						<span>{row.original.videoCount}</span>
					</div>
				),
			},
			{
				accessorKey: 'isPublished',
				header: 'Status',
				cell: ({ row }) => (
					<Badge variant={row.original.isPublished ? 'accent' : 'outline'}>
						{row.original.isPublished ? 'Published' : 'Draft'}
					</Badge>
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
						{column.getIsSorted() === 'asc' ? (
							<ArrowUp className="ml-2 h-4 w-4" />
						) : column.getIsSorted() === 'desc' ? (
							<ArrowDown className="ml-2 h-4 w-4" />
						) : (
							<ArrowUpDown className="ml-2 h-4 w-4" />
						)}
					</Button>
				),
				cell: ({ row }) => formatDate(row.original.createdAt.toISOString()),
			},
			{
				id: 'actions',
				header: 'Actions',
				cell: ({ row }) => {
					const playlist = row.original;
					return (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" className="h-8 w-8 p-0">
									<span className="sr-only">Open menu</span>
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuLabel>Actions</DropdownMenuLabel>
								<DropdownMenuItem asChild>
									<Link
										to="/library/$libraryId/playlist/$playlistId"
										params={{ libraryId, playlistId: playlist.id }}
									>
										<Pencil className="mr-2 h-4 w-4" />
										Edit
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => handleTogglePublish(playlist)}>
									{playlist.isPublished ? (
										<>
											<EyeOff className="mr-2 h-4 w-4" />
											Unpublish
										</>
									) : (
										<>
											<Eye className="mr-2 h-4 w-4" />
											Publish
										</>
									)}
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="text-destructive"
									onClick={() => handleDeleteClick(playlist)}
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					);
				},
			},
		],
		[libraryId, handleDeleteClick, handleTogglePublish],
	);

	const table = useReactTable({
		data: filteredPlaylists,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onSortingChange: (updater) => {
			const newSorting =
				typeof updater === 'function' ? updater(sorting) : updater;
			setSorting(newSorting);
			saveSettings({ tableSorting: newSorting });
		},
		state: {
			sorting,
		},
	});

	if (!playlists || playlists.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<ListVideo className="h-16 w-16 text-muted-foreground mb-4" />
				<h3 className="text-lg font-semibold">No playlists yet</h3>
				<p className="text-muted-foreground mb-4">
					Create your first playlist to organize your videos.
				</p>
				<Button asChild>
					<Link to="/library/$libraryId/create-playlist" params={{ libraryId }}>
						Create Playlist
					</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Controls */}
			<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
				<Input
					placeholder="Search playlists..."
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
					className="max-w-sm"
				/>
				<div className="flex gap-2 items-center">
					{/* View mode toggle */}
					<div className="flex border rounded-md">
						<Button
							variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
							size="sm"
							onClick={() => {
								setViewMode('grid');
								saveSettings({ viewMode: 'grid' });
							}}
						>
							<Grid3X3 className="h-4 w-4" />
						</Button>
						<Button
							variant={viewMode === 'table' ? 'secondary' : 'ghost'}
							size="sm"
							onClick={() => {
								setViewMode('table');
								saveSettings({ viewMode: 'table' });
							}}
						>
							<List className="h-4 w-4" />
						</Button>
					</div>

					{/* Sort controls (grid view only) */}
					{viewMode === 'grid' && (
						<>
							<Select
								value={sortCriteria}
								onValueChange={(value) => {
									setSortCriteria(value);
									saveSettings({ sortCriteria: value });
								}}
							>
								<SelectTrigger className="w-35">
									<SelectValue placeholder="Sort by" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="sortOrder">Order</SelectItem>
									<SelectItem value="name">Name</SelectItem>
									<SelectItem value="date">Date</SelectItem>
									<SelectItem value="videoCount">Videos</SelectItem>
								</SelectContent>
							</Select>
							<Button
								variant="outline"
								size="icon"
								onClick={() => {
									const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
									setSortDirection(newDirection);
									saveSettings({ sortDirection: newDirection });
								}}
							>
								{sortDirection === 'asc' ? (
									<ArrowUp className="h-4 w-4" />
								) : (
									<ArrowDown className="h-4 w-4" />
								)}
							</Button>
						</>
					)}
				</div>
			</div>

			{/* Results count */}
			<p className="text-sm text-muted-foreground">
				{filteredPlaylists.length} playlist
				{filteredPlaylists.length !== 1 ? 's' : ''}
				{searchTerm && ` matching "${searchTerm}"`}
			</p>

			{/* Grid View */}
			{viewMode === 'grid' && (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
					{filteredPlaylists.map((playlist) => (
						<Card key={playlist.id} className="overflow-hidden group p-0">
							<CardHeader className="p-0">
								<Link
									to="/library/$libraryId/playlist/$playlistId"
									params={{ libraryId, playlistId: playlist.id }}
								>
									<div className="relative">
										<VideoThumbnail
											playbackId={playlist.thumbnailPlaybackId}
											alt={playlist.name}
											aspectVideo
											className="w-full object-cover group-hover:scale-105 transition-transform duration-200"
											time={playlist.thumbnailTime ?? 3}
											policy={playlist.thumbnailPolicy ?? undefined}
											libraryId={libraryId}
											fallbackIcon={
												<ListVideo className="h-8 w-8 text-muted-foreground" />
											}
										/>
										<div className="absolute bottom-2 right-2 flex gap-1">
											<Badge>
												<Film className="h-3 w-3 mr-1" />
												{playlist.videoCount}
											</Badge>
										</div>
										{!playlist.isPublished && (
											<div className="absolute top-2 right-2">
												<Badge variant="outline" className="bg-background/80">
													Draft
												</Badge>
											</div>
										)}
									</div>
								</Link>
							</CardHeader>
							<CardContent className="p-3">
								<div className="flex justify-between items-start">
									<div className="flex-1 min-w-0">
										<CardTitle className="text-base truncate">
											<Link
												to="/library/$libraryId/playlist/$playlistId"
												params={{ libraryId, playlistId: playlist.id }}
												className="hover:underline"
											>
												{playlist.name}
											</Link>
										</CardTitle>
										<CardDescription className="text-xs truncate">
											/{playlist.slug}
										</CardDescription>
									</div>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="ghost" className="h-8 w-8 p-0 shrink-0">
												<MoreHorizontal className="h-4 w-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuLabel>Actions</DropdownMenuLabel>
											<DropdownMenuItem asChild>
												<Link
													to="/library/$libraryId/playlist/$playlistId"
													params={{ libraryId, playlistId: playlist.id }}
												>
													<Pencil className="mr-2 h-4 w-4" />
													Edit
												</Link>
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => handleTogglePublish(playlist)}
											>
												{playlist.isPublished ? (
													<>
														<EyeOff className="mr-2 h-4 w-4" />
														Unpublish
													</>
												) : (
													<>
														<Eye className="mr-2 h-4 w-4" />
														Publish
													</>
												)}
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												className="text-destructive"
												onClick={() => handleDeleteClick(playlist)}
											>
												<Trash2 className="mr-2 h-4 w-4" />
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
								<div className="mt-2 text-xs">
									{getPlaylistCategoryLabel(playlist.category)}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Table View */}
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
										No playlists found.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			)}

			{/* Delete dialog */}
			<PlaylistDelete
				playlist={playlistToDelete}
				libraryId={libraryId}
				isOpen={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			/>
		</div>
	);
}
