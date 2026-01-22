import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import {
	Eye,
	EyeOff,
	Film,
	GripVertical,
	ListVideo,
	MoreHorizontal,
	Pencil,
	Save,
	Trash2,
	Undo2,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
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
import { Input } from '@/components/ui/input';
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

export function PlaylistList({ playlists = [], libraryId }: PlaylistListProps) {
	const queryClient = useQueryClient();
	const [searchTerm, setSearchTerm] = useState('');
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(
		null,
	);

	// Local order state for drag-and-drop
	const [localPlaylistOrder, setLocalPlaylistOrder] = useState<string[]>([]);
	const [draggedPlaylistId, setDraggedPlaylistId] = useState<string | null>(
		null,
	);
	const [dragOverPlaylistId, setDragOverPlaylistId] = useState<string | null>(
		null,
	);
	const dragCounter = useRef(0);

	// Initialize local order when playlists load
	useMemo(() => {
		if (playlists && playlists.length > 0) {
			// Sort by sortOrder initially
			const sorted = [...playlists].sort((a, b) => a.sortOrder - b.sortOrder);
			setLocalPlaylistOrder(sorted.map((p) => p.id));
		}
	}, [playlists]);

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

	// Reorder playlists mutation
	const reorderMutation = useMutation(
		trpc.mux.reorderPlaylists.mutationOptions({
			onSuccess: () => {
				toast.success('Playlist order saved');
				queryClient.invalidateQueries({
					queryKey: trpc.mux.listPlaylists.queryKey({ libraryId }),
				});
			},
			onError: (err) => {
				toast.error(`Failed to save playlist order: ${err.message}`);
				// Reset local order on error
				if (playlists) {
					const sorted = [...playlists].sort(
						(a, b) => a.sortOrder - b.sortOrder,
					);
					setLocalPlaylistOrder(sorted.map((p) => p.id));
				}
			},
		}),
	);

	// Filter playlists
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

		return result;
	}, [playlists, searchTerm]);

	// Get playlists in the current local order
	const orderedPlaylists = useMemo(() => {
		if (!filteredPlaylists || filteredPlaylists.length === 0) return [];
		// If search is active, don't apply custom ordering
		if (searchTerm) {
			return [...filteredPlaylists].sort((a, b) => a.sortOrder - b.sortOrder);
		}
		// If localPlaylistOrder hasn't been initialized yet, use original order
		if (localPlaylistOrder.length === 0 && filteredPlaylists.length > 0) {
			return [...filteredPlaylists].sort((a, b) => a.sortOrder - b.sortOrder);
		}
		const playlistsMap = new Map(filteredPlaylists.map((p) => [p.id, p]));
		return localPlaylistOrder
			.map((id) => playlistsMap.get(id))
			.filter((p): p is NonNullable<typeof p> => p !== undefined);
	}, [filteredPlaylists, localPlaylistOrder, searchTerm]);

	// Check if order has been modified
	const originalPlaylistOrder = useMemo(
		() =>
			[...(playlists ?? [])]
				.sort((a, b) => a.sortOrder - b.sortOrder)
				.map((p) => p.id),
		[playlists],
	);
	const hasOrderChanges = useMemo(() => {
		if (localPlaylistOrder.length !== originalPlaylistOrder.length)
			return false;
		return localPlaylistOrder.some(
			(id, index) => id !== originalPlaylistOrder[index],
		);
	}, [localPlaylistOrder, originalPlaylistOrder]);

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

	// Drag and drop handlers
	const handleDragStart = useCallback(
		(e: React.DragEvent<HTMLTableRowElement>, playlistId: string) => {
			setDraggedPlaylistId(playlistId);
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', playlistId);
			setTimeout(() => {
				const element = e.target as HTMLElement;
				element.style.opacity = '0.5';
			}, 0);
		},
		[],
	);

	const handleDragEnd = useCallback(
		(e: React.DragEvent<HTMLTableRowElement>) => {
			const element = e.target as HTMLElement;
			element.style.opacity = '1';
			setDraggedPlaylistId(null);
			setDragOverPlaylistId(null);
			dragCounter.current = 0;
		},
		[],
	);

	const handleDragEnter = useCallback(
		(e: React.DragEvent<HTMLTableRowElement>, playlistId: string) => {
			e.preventDefault();
			dragCounter.current++;
			if (draggedPlaylistId && draggedPlaylistId !== playlistId) {
				setDragOverPlaylistId(playlistId);
			}
		},
		[draggedPlaylistId],
	);

	const handleDragLeave = useCallback(
		(e: React.DragEvent<HTMLTableRowElement>) => {
			e.preventDefault();
			dragCounter.current--;
			if (dragCounter.current === 0) {
				setDragOverPlaylistId(null);
			}
		},
		[],
	);

	const handleDragOver = useCallback(
		(e: React.DragEvent<HTMLTableRowElement>) => {
			e.preventDefault();
			e.dataTransfer.dropEffect = 'move';
		},
		[],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent<HTMLTableRowElement>, targetPlaylistId: string) => {
			e.preventDefault();
			dragCounter.current = 0;

			if (!draggedPlaylistId || draggedPlaylistId === targetPlaylistId) {
				setDragOverPlaylistId(null);
				return;
			}

			setLocalPlaylistOrder((prev) => {
				const draggedIndex = prev.indexOf(draggedPlaylistId);
				const targetIndex = prev.indexOf(targetPlaylistId);

				if (draggedIndex === -1 || targetIndex === -1) return prev;

				const newOrder = [...prev];
				newOrder.splice(draggedIndex, 1);
				newOrder.splice(targetIndex, 0, draggedPlaylistId);
				return newOrder;
			});

			setDragOverPlaylistId(null);
		},
		[draggedPlaylistId],
	);

	const handleSaveOrder = useCallback(() => {
		if (!searchTerm) {
			reorderMutation.mutate({
				libraryId,
				playlistIds: localPlaylistOrder,
			});
		}
	}, [reorderMutation, libraryId, localPlaylistOrder, searchTerm]);

	const handleResetOrder = useCallback(() => {
		setLocalPlaylistOrder(originalPlaylistOrder);
	}, [originalPlaylistOrder]);

	// Table columns
	const columns: ColumnDef<Playlist>[] = useMemo(
		() => [
			{
				id: 'drag-handle',
				header: 'Sort Order',
				size: 40,
				cell: ({ row }) => (
					<Button
						variant="secondary"
						className="cursor-grab active:cursor-grabbing"
					>
						<GripVertical className="size-5" />
						<span className="text-center text-sm font-medium">
							{row.index + 1}
						</span>
					</Button>
				),
			},
			{
				accessorKey: 'thumbnail',
				header: '',
				size: 80,
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
				header: 'Name',
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
				header: 'Videos',
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
				header: 'Created',
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
		data: orderedPlaylists,
		columns,
		getCoreRowModel: getCoreRowModel(),
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
				{hasOrderChanges && !searchTerm && (
					<div className="flex gap-2 items-center">
						<Button
							variant="outline"
							size="sm"
							onClick={handleResetOrder}
							disabled={reorderMutation.isPending}
						>
							<Undo2 className="h-4 w-4 mr-2" />
							Reset Order
						</Button>
						<Button
							variant="default"
							size="sm"
							onClick={handleSaveOrder}
							disabled={reorderMutation.isPending}
						>
							<Save className="h-4 w-4 mr-2" />
							{reorderMutation.isPending ? 'Saving...' : 'Save Order'}
						</Button>
					</div>
				)}
			</div>

			{/* Results count */}
			<div className="flex items-center justify-between">
				<div>
					<span className="text-sm text-muted-foreground">
						Click on playlist title to edit.
					</span>{' '}
					{!searchTerm && (
						<span className="text-sm text-muted-foreground">
							Drag rows to reorder playlists
						</span>
					)}
				</div>
				<p className="text-sm text-muted-foreground">
					{orderedPlaylists.length} playlist
					{orderedPlaylists.length !== 1 ? 's' : ''}
					{searchTerm && ` matching "${searchTerm}"`}
				</p>
			</div>

			{/* Table View */}
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
									draggable={!searchTerm}
									onDragStart={(e) => handleDragStart(e, row.original.id)}
									onDragEnd={handleDragEnd}
									onDragEnter={(e) => handleDragEnter(e, row.original.id)}
									onDragLeave={handleDragLeave}
									onDragOver={handleDragOver}
									onDrop={(e) => handleDrop(e, row.original.id)}
									className={`${!searchTerm ? 'cursor-move' : ''} ${
										dragOverPlaylistId === row.original.id
											? 'border-t-2 border-t-primary'
											: ''
									}`}
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
									No playlists found.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

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
