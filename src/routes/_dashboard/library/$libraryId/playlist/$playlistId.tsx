import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { TRPCClientError } from '@trpc/client';
import {
	ArrowDown,
	ArrowUp,
	Film,
	GripVertical,
	Image,
	ListVideo,
	Loader2,
	MoreHorizontal,
	Pencil,
	Plus,
	Save,
	Settings,
	Tag,
	Trash2,
	Undo2,
	X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DashboardHeader } from '@/components/DashboardHeader';
import { NotFound } from '@/components/NotFound';
import { Badge } from '@/components/ui/badge';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Dialog,
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
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { VideoThumbnail } from '@/components/VideoThumbnail';
import {
	getPlaylistCategoryLabel,
	PLAYLIST_CATEGORY_OPTIONS,
	type PlaylistCategory,
} from '@/lib/constants';
import { playlistSchema } from '@/lib/schemas';
import { trpc } from '@/lib/trpc';
import { formatDuration } from '@/lib/video-helpers';

// Maximum number of videos allowed in a playlist
const MAX_PLAYLIST_VIDEOS = 50;

export const Route = createFileRoute(
	'/_dashboard/library/$libraryId/playlist/$playlistId',
)({
	component: PlaylistEditorPage,
	notFoundComponent: NotFound,
	loader: async ({ context: { queryClient }, params }) => {
		const { libraryId, playlistId } = params;
		try {
			const playlist = await queryClient.ensureQueryData(
				trpc.mux.getPlaylist.queryOptions({ playlistId, libraryId }),
			);
			if (!playlist) {
				throw notFound();
			}
			return { playlistId, libraryId };
		} catch (error) {
			if (
				error instanceof TRPCClientError &&
				error.data?.code === 'NOT_FOUND'
			) {
				throw notFound();
			}
			throw error;
		}
	},
});

function PlaylistEditorPage() {
	const { libraryId, playlistId } = Route.useParams();
	const queryClient = useQueryClient();

	// Fetch playlist with videos
	const {
		data: playlist,
		isLoading,
		error,
	} = useQuery(trpc.mux.getPlaylist.queryOptions({ playlistId, libraryId }));

	// Fetch library details
	const { data: library } = useQuery(
		trpc.mux.getLibrary.queryOptions({ libraryId }, { enabled: !!libraryId }),
	);

	// Fetch all videos in library for adding to playlist
	const { data: allVideosData } = useQuery(
		trpc.mux.listVideosFromDatabase.queryOptions(
			{ libraryId },
			{ enabled: !!libraryId },
		),
	);

	// Form state for editing
	const [isEditing, setIsEditing] = useState(false);
	const [name, setName] = useState('');
	const [slug, setSlug] = useState('');
	const [description, setDescription] = useState('');
	const [category, setCategory] = useState<PlaylistCategory>('featured');
	const [tags, setTags] = useState<string[]>([]);
	const [tagInput, setTagInput] = useState('');

	// Thumbnail state
	const [thumbnailVideoId, setThumbnailVideoId] = useState<string | null>(null);
	const [thumbnailTime, setThumbnailTime] = useState<number>(3);

	// Add video dialog state
	const [isAddVideoOpen, setIsAddVideoOpen] = useState(false);
	const [videoSearch, setVideoSearch] = useState('');

	// Local video order state for drag-and-drop
	const [localVideoOrder, setLocalVideoOrder] = useState<string[]>([]);
	const [draggedVideoId, setDraggedVideoId] = useState<string | null>(null);
	const [dragOverVideoId, setDragOverVideoId] = useState<string | null>(null);
	const dragCounter = useRef(0);

	// Initialize form state when playlist loads
	useEffect(() => {
		if (playlist) {
			setName(playlist.name);
			setSlug(playlist.slug);
			setDescription(playlist.description ?? '');
			setCategory(playlist.category as PlaylistCategory);
			setTags(Array.isArray(playlist.tags) ? playlist.tags : []);
			// Initialize thumbnail state - default to first video at 3 seconds if not set
			const defaultVideoId = playlist.videos?.[0]?.id ?? null;
			setThumbnailVideoId(playlist.thumbnailVideoId ?? defaultVideoId);
			setThumbnailTime(playlist.thumbnailTime ?? 3);
			// Initialize local video order
			setLocalVideoOrder(playlist.videos?.map((v) => v.id) ?? []);
		}
	}, [playlist]);

	// Check if video order has been modified
	const originalVideoOrder = useMemo(
		() => playlist?.videos?.map((v) => v.id) ?? [],
		[playlist?.videos],
	);
	const hasOrderChanges = useMemo(() => {
		if (localVideoOrder.length !== originalVideoOrder.length) return false;
		return localVideoOrder.some(
			(id, index) => id !== originalVideoOrder[index],
		);
	}, [localVideoOrder, originalVideoOrder]);

	// Mutations
	const updateMutation = useMutation(
		trpc.mux.updatePlaylist.mutationOptions({
			onSuccess: () => {
				toast.success('Playlist updated successfully');
				queryClient.invalidateQueries({
					queryKey: trpc.mux.getPlaylist.queryKey({ playlistId, libraryId }),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.mux.listPlaylists.queryKey({ libraryId }),
				});
				setIsEditing(false);
			},
			onError: (err) => {
				toast.error(`Failed to update playlist: ${err.message}`);
			},
		}),
	);

	const togglePublishMutation = useMutation(
		trpc.mux.setPlaylistPublishStatus.mutationOptions({
			onSuccess: (_, variables) => {
				toast.success(
					variables.isPublished ? 'Playlist published' : 'Playlist unpublished',
				);
				queryClient.invalidateQueries({
					queryKey: trpc.mux.getPlaylist.queryKey({ playlistId, libraryId }),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.mux.listPlaylists.queryKey({ libraryId }),
				});
			},
			onError: (err) => {
				toast.error(`Failed to update publish status: ${err.message}`);
			},
		}),
	);

	const addVideoMutation = useMutation(
		trpc.mux.addVideoToPlaylist.mutationOptions({
			onSuccess: () => {
				toast.success('Video added to playlist');
				queryClient.invalidateQueries({
					queryKey: trpc.mux.getPlaylist.queryKey({ playlistId, libraryId }),
				});
				setIsAddVideoOpen(false);
				setVideoSearch('');
			},
			onError: (err) => {
				toast.error(`Failed to add video: ${err.message}`);
			},
		}),
	);

	const removeVideoMutation = useMutation(
		trpc.mux.removeVideoFromPlaylist.mutationOptions({
			onSuccess: () => {
				toast.success('Video removed from playlist');
				queryClient.invalidateQueries({
					queryKey: trpc.mux.getPlaylist.queryKey({ playlistId, libraryId }),
				});
			},
			onError: (err) => {
				toast.error(`Failed to remove video: ${err.message}`);
			},
		}),
	);

	const reorderMutation = useMutation(
		trpc.mux.reorderPlaylistVideos.mutationOptions({
			onSuccess: () => {
				toast.success('Playlist order saved');
				queryClient.invalidateQueries({
					queryKey: trpc.mux.getPlaylist.queryKey({ playlistId, libraryId }),
				});
			},
			onError: (err) => {
				toast.error(`Failed to save playlist order: ${err.message}`);
				// Reset local order on error
				setLocalVideoOrder(originalVideoOrder);
			},
		}),
	);

	const handleSave = () => {
		const result = playlistSchema.safeParse({
			name,
			slug,
			description: description || undefined,
			tags: tags.length > 0 ? tags : undefined,
		});

		if (!result.success) {
			const firstError = result.error.issues[0];
			toast.error(firstError.message);
			return;
		}

		updateMutation.mutate({
			playlistId,
			libraryId,
			name: result.data.name,
			slug: result.data.slug,
			description: result.data.description,
			category,
			tags: result.data.tags,
			thumbnailVideoId,
			thumbnailTime,
		});
	};

	const handleCancel = () => {
		if (playlist) {
			setName(playlist.name);
			setSlug(playlist.slug);
			setDescription(playlist.description ?? '');
			setCategory(playlist.category as PlaylistCategory);
			setTags(Array.isArray(playlist.tags) ? playlist.tags : []);
			// Reset thumbnail state
			const defaultVideoId = playlist.videos?.[0]?.id ?? null;
			setThumbnailVideoId(playlist.thumbnailVideoId ?? defaultVideoId);
			setThumbnailTime(playlist.thumbnailTime ?? 3);
		}
		setIsEditing(false);
	};

	const generateSlug = (text: string): string => {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	};

	const handleNameChange = (newName: string) => {
		setName(newName);
		// Only auto-generate slug if it hasn't been manually edited
		if (!slug || slug === generateSlug(name)) {
			setSlug(generateSlug(newName));
		}
	};

	const handleAddTag = () => {
		const trimmedTag = tagInput.trim();
		if (trimmedTag && !tags.includes(trimmedTag)) {
			setTags([...tags, trimmedTag]);
			setTagInput('');
		}
	};

	const handleRemoveTag = (tagToRemove: string) => {
		setTags(tags.filter((tag) => tag !== tagToRemove));
	};

	const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleAddTag();
		}
	};

	const handleTogglePublish = () => {
		if (playlist) {
			togglePublishMutation.mutate({
				playlistId,
				libraryId,
				isPublished: !playlist.isPublished,
			});
		}
	};

	const handleAddVideo = (videoId: string) => {
		addVideoMutation.mutate({ playlistId, libraryId, videoId });
	};

	const handleRemoveVideo = (videoId: string) => {
		removeVideoMutation.mutate({ playlistId, libraryId, videoId });
	};

	const handleMoveVideo = useCallback(
		(videoId: string, direction: 'up' | 'down') => {
			setLocalVideoOrder((prev) => {
				const currentIndex = prev.indexOf(videoId);
				if (currentIndex === -1) return prev;

				const newIndex =
					direction === 'up' ? currentIndex - 1 : currentIndex + 1;
				if (newIndex < 0 || newIndex >= prev.length) return prev;

				const newOrder = [...prev];
				[newOrder[currentIndex], newOrder[newIndex]] = [
					newOrder[newIndex],
					newOrder[currentIndex],
				];
				return newOrder;
			});
		},
		[],
	);

	// Drag and drop handlers
	const handleDragStart = useCallback(
		(e: React.DragEvent<HTMLElement>, videoId: string) => {
			setDraggedVideoId(videoId);
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', videoId);
			// Add a slight delay to allow the drag image to be set
			setTimeout(() => {
				const element = e.target as HTMLElement;
				element.style.opacity = '0.5';
			}, 0);
		},
		[],
	);

	const handleDragEnd = useCallback((e: React.DragEvent<HTMLElement>) => {
		const element = e.target as HTMLElement;
		element.style.opacity = '1';
		setDraggedVideoId(null);
		setDragOverVideoId(null);
		dragCounter.current = 0;
	}, []);

	const handleDragEnter = useCallback(
		(e: React.DragEvent<HTMLElement>, videoId: string) => {
			e.preventDefault();
			dragCounter.current++;
			if (draggedVideoId && draggedVideoId !== videoId) {
				setDragOverVideoId(videoId);
			}
		},
		[draggedVideoId],
	);

	const handleDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
		e.preventDefault();
		dragCounter.current--;
		if (dragCounter.current === 0) {
			setDragOverVideoId(null);
		}
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent<HTMLElement>, targetVideoId: string) => {
			e.preventDefault();
			dragCounter.current = 0;

			if (!draggedVideoId || draggedVideoId === targetVideoId) {
				setDragOverVideoId(null);
				return;
			}

			setLocalVideoOrder((prev) => {
				const draggedIndex = prev.indexOf(draggedVideoId);
				const targetIndex = prev.indexOf(targetVideoId);

				if (draggedIndex === -1 || targetIndex === -1) return prev;

				const newOrder = [...prev];
				newOrder.splice(draggedIndex, 1);
				newOrder.splice(targetIndex, 0, draggedVideoId);
				return newOrder;
			});

			setDragOverVideoId(null);
		},
		[draggedVideoId],
	);

	const handleSaveOrder = useCallback(() => {
		reorderMutation.mutate({
			playlistId,
			libraryId,
			videoIds: localVideoOrder,
		});
	}, [reorderMutation, playlistId, libraryId, localVideoOrder]);

	const handleResetOrder = useCallback(() => {
		setLocalVideoOrder(originalVideoOrder);
	}, [originalVideoOrder]);

	// Filter videos that aren't already in the playlist
	const availableVideos = allVideosData?.filter(
		(video) =>
			!playlist?.videos?.some((item) => item.id === video.id) &&
			video.status === 'ready' &&
			(videoSearch === '' ||
				video.title.toLowerCase().includes(videoSearch.toLowerCase())),
	);

	// Get videos in the current local order
	const playlistVideos = useMemo(() => {
		if (!playlist?.videos) return [];
		// If localVideoOrder hasn't been initialized yet, use original order
		if (localVideoOrder.length === 0 && playlist.videos.length > 0) {
			return playlist.videos;
		}
		const videosMap = new Map(playlist.videos.map((v) => [v.id, v]));
		return localVideoOrder
			.map((id) => videosMap.get(id))
			.filter((v): v is NonNullable<typeof v> => v !== undefined);
	}, [playlist?.videos, localVideoOrder]);

	const libraryName = library?.name ?? 'Library';

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (error || !playlist) {
		return (
			<div className="flex flex-col items-center justify-center gap-4 py-12">
				<p className="text-destructive">
					{error?.message ?? 'Playlist not found'}
				</p>
				<Button asChild>
					<Link to="/library/$libraryId/playlists" params={{ libraryId }}>
						Back to Playlists
					</Link>
				</Button>
			</div>
		);
	}

	return (
		<>
			<DashboardHeader heading={isEditing ? 'Edit Playlist' : playlist.name}>
				<div className="pt-2 flex items-center justify-between">
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink href="/">All Libraries</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbLink asChild>
									<Link
										to="/library/$libraryId/playlists"
										params={{ libraryId }}
									>
										{libraryName} Playlists
									</Link>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>{playlist.name}</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>

					<div className="flex items-center gap-4">
						{!isEditing ? (
							<Button size="sm" onClick={() => setIsEditing(true)}>
								<Pencil className="mr-2 size-4" />
								Edit Playlist
							</Button>
						) : (
							<>
								<Button size="sm" variant="outline" onClick={handleCancel}>
									<X className="mr-2 size-4" />
									Cancel
								</Button>
								<Button
									size="sm"
									onClick={handleSave}
									disabled={updateMutation.isPending}
								>
									{updateMutation.isPending ? (
										<Loader2 className="mr-2 size-4 animate-spin" />
									) : (
										<Save className="mr-2 size-4" />
									)}
									Save
								</Button>
							</>
						)}
					</div>
				</div>
			</DashboardHeader>

			<section className="space-y-6">
				{/* Playlist Info */}
				<div className="grid gap-6 lg:grid-cols-3">
					{/* Details Card */}
					<Card className="lg:col-span-2">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Settings className="size-5" />
								Playlist Details
							</CardTitle>
							<CardDescription>
								{isEditing
									? 'Edit your playlist information.'
									: 'View your playlist information.'}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							{isEditing ? (
								<>
									<div className="space-y-2">
										<Label htmlFor="name">
											Name <span className="text-destructive">*</span>
										</Label>
										<Input
											id="name"
											value={name}
											onChange={(e) => handleNameChange(e.target.value)}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="slug">
											Slug <span className="text-destructive">*</span>
										</Label>
										<Input
											id="slug"
											value={slug}
											onChange={(e) => setSlug(e.target.value)}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="description">Description</Label>
										<Textarea
											id="description"
											value={description}
											onChange={(e) => setDescription(e.target.value)}
											rows={3}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="category">Category</Label>
										<Select
											value={category}
											onValueChange={(value) =>
												setCategory(value as PlaylistCategory)
											}
										>
											<SelectTrigger id="category">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{PLAYLIST_CATEGORY_OPTIONS.map((item) => (
													<SelectItem key={item.value} value={item.value}>
														{item.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label htmlFor="publish-status">Published</Label>
										<Switch
											id="publish-status"
											checked={playlist.isPublished}
											onCheckedChange={handleTogglePublish}
											disabled={togglePublishMutation.isPending}
										/>
										<p className="text-xs text-muted-foreground">
											{playlist.isPublished
												? 'The playlist is currently published and visible on airwartrail.com.'
												: 'The playlist is currently not published and will not be visible on airwartrail.com.'}
										</p>
									</div>
								</>
							) : (
								<div className="space-y-4">
									<div className="grid gap-4 sm:grid-cols-2">
										<div>
											<p className="text-sm font-medium text-muted-foreground">
												Name
											</p>
											<p>{playlist.name}</p>
										</div>
										<div>
											<p className="text-sm font-medium text-muted-foreground">
												Slug
											</p>
											<p className="font-mono text-sm">/{playlist.slug}</p>
										</div>
										<div>
											<p className="text-sm font-medium text-muted-foreground">
												Category
											</p>
											<Badge variant="secondary">
												{getPlaylistCategoryLabel(
													playlist.category as PlaylistCategory,
												)}
											</Badge>
										</div>
										<div>
											<p className="text-sm font-medium text-muted-foreground">
												Status
											</p>
											<Badge
												variant={playlist.isPublished ? 'accent' : 'outline'}
											>
												{playlist.isPublished ? 'Published' : 'Unpublished'}
											</Badge>
										</div>
										{playlist.description && (
											<div>
												<p className="text-sm text-balance font-medium text-muted-foreground">
													Description
												</p>
												<p>{playlist.description}</p>
											</div>
										)}
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Tags Card */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Tag className="size-5" />
								Tags
							</CardTitle>
							<CardDescription>
								{isEditing ? 'Manage playlist tags.' : 'Playlist tags.'}
							</CardDescription>
						</CardHeader>
						<CardContent>
							{isEditing ? (
								<div className="space-y-4">
									<div className="flex gap-2">
										<Input
											value={tagInput}
											onChange={(e) => setTagInput(e.target.value)}
											onKeyDown={handleTagKeyDown}
											placeholder="Add tag..."
											className="flex-1"
										/>
										<Button
											type="button"
											variant="secondary"
											size="sm"
											onClick={handleAddTag}
											disabled={!tagInput.trim()}
										>
											<Plus className="size-4" />
										</Button>
									</div>
									<div className="flex flex-wrap gap-2">
										{tags.map((tag) => (
											<span
												key={tag}
												className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"
											>
												{tag}
												<button
													type="button"
													onClick={() => handleRemoveTag(tag)}
													className="ml-1 rounded-full p-0.5 hover:bg-secondary-foreground/10"
												>
													×
												</button>
											</span>
										))}
										{tags.length === 0 && (
											<p className="text-sm text-muted-foreground">No tags</p>
										)}
									</div>
								</div>
							) : (
								<div className="flex flex-wrap gap-2">
									{(Array.isArray(playlist.tags) ? playlist.tags : []).length >
									0 ? (
										(Array.isArray(playlist.tags) ? playlist.tags : []).map(
											(tag: string) => (
												<Badge key={tag} variant="secondary">
													{tag}
												</Badge>
											),
										)
									) : (
										<p className="text-sm text-muted-foreground">No tags</p>
									)}
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Thumbnail Section */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Image className="size-5" />
							Playlist Thumbnail
						</CardTitle>
						<CardDescription>
							The thumbnail image representing this playlist. The default image
							is taken from the first video in the playlist. You may override
							this by selecting a different video and time to generate the image
							thumbnail.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid gap-6 sm:grid-cols-2">
							{/* Thumbnail Preview */}
							<div className="space-y-2">
								<Label>Preview</Label>
								<div className="max-w-40 aspect-video overflow-hidden rounded-lg border">
									{(() => {
										// Get the playback ID for the selected thumbnail video
										const selectedVideo = thumbnailVideoId
											? playlistVideos.find((v) => v.id === thumbnailVideoId)
											: playlistVideos[0];
										const playbackId = selectedVideo?.muxPlaybackId;
										const policy = selectedVideo?.playbackPolicy ?? undefined;

										return (
											<VideoThumbnail
												playbackId={playbackId}
												alt={`${playlist.name} thumbnail`}
												aspectVideo
												time={thumbnailTime}
												policy={policy}
												libraryId={libraryId}
												fallbackIcon={
													<ListVideo className="size-12 text-muted-foreground" />
												}
											/>
										);
									})()}
								</div>
								<p className="text-xs text-muted-foreground">
									Thumbnail at {thumbnailTime} seconds
								</p>
							</div>

							{/* Thumbnail Settings */}
							{isEditing ? (
								<div className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="thumbnail-video">Video</Label>
										<Select
											value={thumbnailVideoId ?? 'auto'}
											onValueChange={(value) =>
												setThumbnailVideoId(value === 'auto' ? null : value)
											}
										>
											<SelectTrigger id="thumbnail-video">
												<SelectValue placeholder="Select video for thumbnail" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="auto">First video (auto)</SelectItem>
												{playlistVideos.map((video) => (
													<SelectItem key={video.id} value={video.id}>
														{video.customTitle || video.title}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<p className="text-xs text-muted-foreground">
											Select which video to use for the playlist thumbnail
										</p>
									</div>

									<div className="space-y-2">
										<Label htmlFor="thumbnail-time">Time (seconds)</Label>
										<Input
											id="thumbnail-time"
											type="number"
											min={0}
											step={0.1}
											value={thumbnailTime}
											onChange={(e) =>
												setThumbnailTime(
													Math.max(0, Number.parseFloat(e.target.value) || 0),
												)
											}
										/>
										<p className="text-xs text-muted-foreground">
											The time in seconds to capture the thumbnail from
										</p>
									</div>
								</div>
							) : (
								<div className="space-y-4">
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Video Source
										</p>
										<p>
											{thumbnailVideoId
												? (playlistVideos.find((v) => v.id === thumbnailVideoId)
														?.title ?? 'Selected video')
												: 'First video (auto)'}
										</p>
									</div>
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Time
										</p>
										<p>{thumbnailTime} seconds</p>
									</div>
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				{/* Videos Section */}
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="flex items-center gap-2">
									<ListVideo className="size-5" />
									Videos ({playlistVideos.length}/{MAX_PLAYLIST_VIDEOS})
								</CardTitle>
								<CardDescription>
									Manage videos in this playlist. Drag up or down or use buttons
									to reorder the videos. A maximum of {MAX_PLAYLIST_VIDEOS}{' '}
									videos may be added to the playlist.
								</CardDescription>
							</div>
							<div className="flex items-center gap-2">
								{hasOrderChanges && (
									<>
										<Button
											size="sm"
											variant="outline"
											onClick={handleResetOrder}
											disabled={reorderMutation.isPending}
										>
											<Undo2 className="mr-2 size-4" />
											Reset
										</Button>
										<Button
											size="sm"
											onClick={handleSaveOrder}
											disabled={reorderMutation.isPending}
										>
											{reorderMutation.isPending ? (
												<Loader2 className="mr-2 size-4 animate-spin" />
											) : (
												<Save className="mr-2 size-4" />
											)}
											Save Order
										</Button>
									</>
								)}
								<Button
									size="sm"
									onClick={() => setIsAddVideoOpen(true)}
									disabled={playlistVideos.length >= MAX_PLAYLIST_VIDEOS}
								>
									<Plus className="mr-2 size-4" />
									Add Video
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						{playlistVideos.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<Film className="mb-4 size-12 text-muted-foreground" />
								<h3 className="text-lg font-semibold">No videos yet</h3>
								<p className="mt-1 text-sm text-muted-foreground">
									Add videos to your playlist to get started.
								</p>
								<Button
									variant="outline"
									className="mt-4"
									onClick={() => setIsAddVideoOpen(true)}
									disabled={playlistVideos.length >= MAX_PLAYLIST_VIDEOS}
								>
									<Plus className="mr-2 size-4" />
									Add First Video
								</Button>
							</div>
						) : (
							<ul className="space-y-2 list-none p-0 m-0">
								{playlistVideos.map((item, index) => (
									<li
										key={item.id}
										draggable
										onDragStart={(e) => handleDragStart(e, item.id)}
										onDragEnd={handleDragEnd}
										onDragEnter={(e) => handleDragEnter(e, item.id)}
										onDragLeave={handleDragLeave}
										onDragOver={handleDragOver}
										onDrop={(e) => handleDrop(e, item.id)}
										className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
											dragOverVideoId === item.id
												? 'border-primary bg-primary/5'
												: ''
										} ${draggedVideoId === item.id ? 'opacity-50' : ''}`}
									>
										<Button
											variant="secondary"
											className="cursor-grab active:cursor-grabbing"
										>
											<GripVertical className="size-5" />
											<span className="text-center text-sm font-medium">
												{index + 1}
											</span>
										</Button>

										<div className="h-14 w-24 shrink-0 overflow-hidden rounded-md">
											<VideoThumbnail
												playbackId={item.muxPlaybackId}
												alt={item.title}
												policy={item.playbackPolicy ?? undefined}
												libraryId={libraryId}
											/>
										</div>

										<div className="min-w-0 flex-1">
											<Link
												to="/library/$libraryId/edit-video/$videoId"
												params={{ libraryId, videoId: item.id }}
												className="font-medium hover:underline line-clamp-1"
											>
												{item.customTitle || item.title}
											</Link>
											<p className="text-sm text-muted-foreground">
												{item.duration
													? formatDuration(item.duration)
													: 'Duration unknown'}
											</p>
										</div>

										<div className="flex items-center gap-1">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => handleMoveVideo(item.id, 'up')}
												disabled={index === 0 || reorderMutation.isPending}
											>
												<ArrowUp className="size-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => handleMoveVideo(item.id, 'down')}
												disabled={
													index === playlistVideos.length - 1 ||
													reorderMutation.isPending
												}
											>
												<ArrowDown className="size-4" />
											</Button>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button variant="ghost" size="icon">
														<MoreHorizontal className="size-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem asChild>
														<Link
															to="/library/$libraryId/edit-video/$videoId"
															params={{ libraryId, videoId: item.id }}
														>
															<Pencil className="mr-2 size-4" />
															Edit Video
														</Link>
													</DropdownMenuItem>
													<DropdownMenuSeparator />
													<DropdownMenuItem
														className="text-destructive"
														onClick={() => handleRemoveVideo(item.id)}
													>
														<Trash2 className="mr-2 size-4" />
														Remove from Playlist
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</Card>
			</section>

			{/* Add Video Dialog */}
			<Dialog open={isAddVideoOpen} onOpenChange={setIsAddVideoOpen}>
				<DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Add Video to Playlist</DialogTitle>
						<DialogDescription>
							{playlistVideos.length >= MAX_PLAYLIST_VIDEOS ? (
								<span className="text-destructive">
									This playlist has reached the maximum of {MAX_PLAYLIST_VIDEOS}{' '}
									videos.
								</span>
							) : (
								<>
									Select a video to add to this playlist.
									<span className="text-muted-foreground ml-1">
										({playlistVideos.length} / {MAX_PLAYLIST_VIDEOS} videos)
									</span>
								</>
							)}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<Input
							placeholder="Search videos..."
							value={videoSearch}
							onChange={(e) => setVideoSearch(e.target.value)}
						/>

						<div className="max-h-100 space-y-2 overflow-y-auto">
							{availableVideos && availableVideos.length > 0 ? (
								availableVideos.map((video) => (
									<button
										key={video.id}
										type="button"
										className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
										onClick={() => handleAddVideo(video.id)}
										disabled={
											addVideoMutation.isPending ||
											playlistVideos.length >= MAX_PLAYLIST_VIDEOS
										}
									>
										<div className="h-12 w-20 shrink-0 overflow-hidden rounded-md">
											<VideoThumbnail
												playbackId={video.playbackId}
												alt={video.title}
												policy={video.policy ?? undefined}
												libraryId={libraryId}
											/>
										</div>
										<div className="min-w-0 flex-1">
											<p className="font-medium line-clamp-1">{video.title}</p>
											<p className="text-sm text-muted-foreground">
												{video.duration
													? formatDuration(video.duration)
													: 'Duration unknown'}
											</p>
										</div>
										{addVideoMutation.isPending &&
										addVideoMutation.variables?.videoId === video.id ? (
											<Loader2 className="size-4 animate-spin" />
										) : (
											<Plus className="size-4 text-muted-foreground" />
										)}
									</button>
								))
							) : (
								<div className="py-8 text-center">
									<p className="text-sm text-muted-foreground">
										{videoSearch
											? 'No videos match your search'
											: 'No more videos available to add'}
									</p>
								</div>
							)}
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setIsAddVideoOpen(false)}>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
