import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	createFileRoute,
	Link,
	notFound,
	useNavigate,
} from '@tanstack/react-router';
import { TRPCClientError } from '@trpc/client';
import {
	ArrowDown,
	ArrowUp,
	Check,
	GripVertical,
	ImageIcon,
	ImageOff,
	Images,
	Loader2,
	Lock,
	MoreHorizontal,
	Pencil,
	Plus,
	Save,
	Settings,
	Star,
	Trash2,
	TriangleAlert,
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
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemHeader,
	ItemMedia,
	ItemTitle,
} from '@/components/ui/item';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';

// Maximum number of images allowed in an album
const MAX_ALBUM_IMAGES = 100;

// Build image URL with variant
function getImageUrl(deliveryUrl: string, variant = 'thumbnail'): string {
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

export const Route = createFileRoute('/_dashboard/images/albums/$albumId')({
	component: AlbumEditorPage,
	notFoundComponent: NotFound,
	loader: async ({ context: { queryClient }, params }) => {
		const { albumId } = params;
		try {
			const album = await queryClient.ensureQueryData(
				trpc.cfImages.albums.getAlbum.queryOptions({ id: albumId }),
			);
			if (!album) {
				throw notFound();
			}
			return { albumId };
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

function AlbumEditorPage() {
	const { albumId } = Route.useParams();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	// Fetch album with images
	const {
		data: album,
		isLoading,
		error,
	} = useQuery(trpc.cfImages.albums.getAlbum.queryOptions({ id: albumId }));

	// Fetch all images for adding to album
	const { data: allImagesData } = useQuery({
		...trpc.cfImages.images.listImages.queryOptions({
			limit: 100,
			page: 1,
			sortOrder: 'desc',
		}),
	});

	// Form state for editing
	const [isEditing, setIsEditing] = useState(false);
	const [title, setTitle] = useState('');
	const [slug, setSlug] = useState('');
	const [description, setDescription] = useState('');

	// Add image dialog state
	const [isAddImageOpen, setIsAddImageOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [imageSearch, setImageSearch] = useState('');
	const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(
		new Set(),
	);

	// Local image order state for drag-and-drop
	const [localImageOrder, setLocalImageOrder] = useState<string[]>([]);
	const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
	const [dragOverImageId, setDragOverImageId] = useState<string | null>(null);
	const dragCounter = useRef(0);

	// Initialize form state when album loads
	useEffect(() => {
		if (album) {
			setTitle(album.title);
			setSlug(album.slug);
			setDescription(album.description ?? '');
			// Initialize local image order from album images
			setLocalImageOrder(album.images?.map((ai) => ai.imageId) ?? []);
		}
	}, [album]);

	// Check if image order has been modified
	const originalImageOrder = useMemo(
		() => album?.images?.map((ai) => ai.imageId) ?? [],
		[album?.images],
	);
	const hasOrderChanges = useMemo(() => {
		if (localImageOrder.length !== originalImageOrder.length) return false;
		return localImageOrder.some(
			(id, index) => id !== originalImageOrder[index],
		);
	}, [localImageOrder, originalImageOrder]);

	// Get the album images in the current local order
	const albumImages = useMemo(() => {
		if (!album?.images) return [];
		if (localImageOrder.length === 0 && album.images.length > 0) {
			return album.images;
		}
		const imagesMap = new Map(album.images.map((ai) => [ai.imageId, ai]));
		return localImageOrder
			.map((id) => imagesMap.get(id))
			.filter((ai): ai is NonNullable<typeof ai> => ai !== undefined);
	}, [album?.images, localImageOrder]);

	// Extract IDs of album images that need signed URLs
	const albumImageIdsNeedingSigning = useMemo(() => {
		return albumImages
			.filter((ai) => ai.image?.requireSignedURLs)
			.map((ai) => ai.imageId);
	}, [albumImages]);

	// Extract IDs of available (non-album) images that need signed URLs
	const availableImageIdsNeedingSigning = useMemo(() => {
		return (allImagesData?.images ?? [])
			.filter((img) => img.requireSignedURLs)
			.map((img) => img.id);
	}, [allImagesData?.images]);

	// Fetch signed URLs for album images
	const { data: albumSignedUrls } = useQuery({
		...trpc.cfImages.signedUrls.signBatch.queryOptions({
			imageIds: albumImageIdsNeedingSigning,
			variant: 'thumbnail',
			expirationSeconds: 3600,
		}),
		enabled: albumImageIdsNeedingSigning.length > 0,
	});

	// Fetch signed URLs for available images (shown in Add Image dialog)
	const { data: availableSignedUrls } = useQuery({
		...trpc.cfImages.signedUrls.signBatch.queryOptions({
			imageIds: availableImageIdsNeedingSigning,
			variant: 'thumbnail',
			expirationSeconds: 3600,
		}),
		enabled: availableImageIdsNeedingSigning.length > 0,
	});

	// Fetch a signed URL for the cover image with 'md' variant for larger preview
	const coverImageId = album?.coverImage?.requireSignedURLs
		? album.coverImage.id
		: undefined;
	const { data: coverSignedUrl } = useQuery({
		...trpc.cfImages.signedUrls.signBatch.queryOptions({
			imageIds: coverImageId ? [coverImageId] : [],
			variant: 'md',
			expirationSeconds: 3600,
		}),
		enabled: !!coverImageId,
	});

	// Create a merged lookup map for signed URLs from both sources
	const signedUrlMap = useMemo(() => {
		const map = new Map<string, string>();
		for (const img of albumSignedUrls?.images ?? []) {
			map.set(img.imageId, img.url);
		}
		for (const img of availableSignedUrls?.images ?? []) {
			map.set(img.imageId, img.url);
		}
		return map;
	}, [albumSignedUrls, availableSignedUrls]);

	// Separate map for 'md' variant signed URLs (cover image)
	const signedUrlMdMap = useMemo(() => {
		const map = new Map<string, string>();
		for (const img of coverSignedUrl?.images ?? []) {
			map.set(img.imageId, img.url);
		}
		return map;
	}, [coverSignedUrl]);

	// Helper to get the correct image URL (signed or plain)
	const getImageUrlForDisplay = useCallback(
		(
			imageId: string,
			deliveryUrl: string,
			requireSigned: boolean,
			variant = 'thumbnail',
		): string => {
			if (requireSigned) {
				const urlMap = variant === 'md' ? signedUrlMdMap : signedUrlMap;
				const signedUrl = urlMap.get(imageId);
				if (signedUrl) return signedUrl;
			}
			return getImageUrl(deliveryUrl, variant);
		},
		[signedUrlMap, signedUrlMdMap],
	);

	// ---------- Mutations ----------

	const updateAlbumMutation = useMutation(
		trpc.cfImages.albums.updateAlbum.mutationOptions({
			onSuccess: () => {
				toast.success('Album updated successfully');
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'getAlbum']],
				});
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'listAlbums']],
				});
				setIsEditing(false);
			},
			onError: (err) => {
				if (
					err.data?.code === 'CONFLICT' ||
					err.message.toLowerCase().includes('slug')
				) {
					toast.error('Slug already exists', {
						description: 'An album with this slug already exists.',
					});
				} else {
					toast.error(`Failed to update album: ${err.message}`);
				}
			},
		}),
	);

	const publishAlbumMutation = useMutation(
		trpc.cfImages.albums.publishAlbum.mutationOptions({
			onSuccess: () => {
				toast.success('Album published');
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'getAlbum']],
				});
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'listAlbums']],
				});
			},
			onError: (err) => {
				toast.error(`Failed to publish album: ${err.message}`);
			},
		}),
	);

	const unpublishAlbumMutation = useMutation(
		trpc.cfImages.albums.unpublishAlbum.mutationOptions({
			onSuccess: () => {
				toast.success('Album unpublished');
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'getAlbum']],
				});
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'listAlbums']],
				});
			},
			onError: (err) => {
				toast.error(`Failed to unpublish album: ${err.message}`);
			},
		}),
	);

	const archiveAlbumMutation = useMutation(
		trpc.cfImages.albums.archiveAlbum.mutationOptions({
			onSuccess: () => {
				toast.success('Album archived');
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'getAlbum']],
				});
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'listAlbums']],
				});
			},
			onError: (err) => {
				toast.error(`Failed to archive album: ${err.message}`);
			},
		}),
	);

	const addImagesMutation = useMutation(
		trpc.cfImages.albumImages.addImagesToAlbum.mutationOptions({
			onSuccess: (data) => {
				const count = data.added ?? selectedImageIds.size;
				toast.success(`${count} image${count !== 1 ? 's' : ''} added to album`);
				// Auto-set first image as cover if album has no cover
				if (!album?.coverImageId && selectedImageIds.size > 0) {
					const firstImageId = Array.from(selectedImageIds)[0];
					setCoverImageMutation.mutate({ albumId, imageId: firstImageId });
				}
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'getAlbum']],
				});
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'listAlbums']],
				});
				setSelectedImageIds(new Set());
				setIsAddImageOpen(false);
				setImageSearch('');
			},
			onError: (err) => {
				toast.error(`Failed to add images: ${err.message}`);
			},
		}),
	);

	const removeImageMutation = useMutation(
		trpc.cfImages.albumImages.removeImageFromAlbum.mutationOptions({
			onSuccess: () => {
				toast.success('Image removed from album');
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'getAlbum']],
				});
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'listAlbums']],
				});
			},
			onError: (err) => {
				toast.error(`Failed to remove image: ${err.message}`);
			},
		}),
	);

	const reorderMutation = useMutation(
		trpc.cfImages.albumImages.reorderAlbumImages.mutationOptions({
			onSuccess: () => {
				toast.success('Image order saved');
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'getAlbum']],
				});
			},
			onError: (err) => {
				toast.error(`Failed to save image order: ${err.message}`);
				setLocalImageOrder(originalImageOrder);
			},
		}),
	);

	const setCoverImageMutation = useMutation(
		trpc.cfImages.albumImages.setCoverImage.mutationOptions({
			onSuccess: () => {
				toast.success('Cover image updated');
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'getAlbum']],
				});
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'listAlbums']],
				});
			},
			onError: (err) => {
				toast.error(`Failed to set cover image: ${err.message}`);
			},
		}),
	);

	const deleteAlbumMutation = useMutation(
		trpc.cfImages.albums.deleteAlbum.mutationOptions({
			onSuccess: () => {
				toast.success('Album deleted');
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'albums', 'listAlbums']],
				});
				navigate({ to: '/images/albums' });
			},
			onError: (err) => {
				toast.error(`Failed to delete album: ${err.message}`);
			},
		}),
	);

	// ---------- Handlers ----------

	const generateSlug = (value: string): string => {
		return value
			.toLowerCase()
			.trim()
			.replace(/[^\w\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-');
	};

	const handleTitleChange = (newTitle: string) => {
		setTitle(newTitle);
		if (!slug || slug === generateSlug(title)) {
			setSlug(generateSlug(newTitle));
		}
	};

	const handleSave = () => {
		if (!title.trim()) {
			toast.error('Title is required');
			return;
		}
		if (!slug.trim()) {
			toast.error('Slug is required');
			return;
		}

		updateAlbumMutation.mutate({
			id: albumId,
			title: title.trim(),
			slug: slug.trim(),
			description: description.trim() || null,
		});
	};

	const handleCancel = () => {
		if (album) {
			setTitle(album.title);
			setSlug(album.slug);
			setDescription(album.description ?? '');
		}
		setIsEditing(false);
	};

	const handleStatusChange = (newStatus: string) => {
		switch (newStatus) {
			case 'published':
				publishAlbumMutation.mutate({ id: albumId });
				break;
			case 'draft':
				unpublishAlbumMutation.mutate({ id: albumId });
				break;
			case 'archived':
				archiveAlbumMutation.mutate({ id: albumId });
				break;
		}
	};

	const handleDeleteAlbum = () => {
		deleteAlbumMutation.mutate({ id: albumId });
	};

	const handleToggleImageSelection = (imageId: string) => {
		setSelectedImageIds((prev) => {
			const next = new Set(prev);
			if (next.has(imageId)) {
				next.delete(imageId);
			} else {
				next.add(imageId);
			}
			return next;
		});
	};

	const handleAddSelectedImages = () => {
		if (selectedImageIds.size === 0) return;
		addImagesMutation.mutate({
			albumId,
			imageIds: Array.from(selectedImageIds),
		});
	};

	const handleRemoveImage = (imageId: string) => {
		removeImageMutation.mutate({ albumId, imageId });
	};

	const handleSetCoverImage = (imageId: string) => {
		setCoverImageMutation.mutate({ albumId, imageId });
	};

	const handleMoveImage = useCallback(
		(imageId: string, direction: 'up' | 'down') => {
			setLocalImageOrder((prev) => {
				const currentIndex = prev.indexOf(imageId);
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
		(e: React.DragEvent<HTMLElement>, imageId: string) => {
			setDraggedImageId(imageId);
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', imageId);
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
		setDraggedImageId(null);
		setDragOverImageId(null);
		dragCounter.current = 0;
	}, []);

	const handleDragEnter = useCallback(
		(e: React.DragEvent<HTMLElement>, imageId: string) => {
			e.preventDefault();
			dragCounter.current++;
			if (draggedImageId && draggedImageId !== imageId) {
				setDragOverImageId(imageId);
			}
		},
		[draggedImageId],
	);

	const handleDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
		e.preventDefault();
		dragCounter.current--;
		if (dragCounter.current === 0) {
			setDragOverImageId(null);
		}
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent<HTMLElement>, targetImageId: string) => {
			e.preventDefault();
			dragCounter.current = 0;

			if (!draggedImageId || draggedImageId === targetImageId) {
				setDragOverImageId(null);
				return;
			}

			setLocalImageOrder((prev) => {
				const draggedIndex = prev.indexOf(draggedImageId);
				const targetIndex = prev.indexOf(targetImageId);

				if (draggedIndex === -1 || targetIndex === -1) return prev;

				const newOrder = [...prev];
				newOrder.splice(draggedIndex, 1);
				newOrder.splice(targetIndex, 0, draggedImageId);
				return newOrder;
			});

			setDragOverImageId(null);
		},
		[draggedImageId],
	);

	const handleSaveOrder = useCallback(() => {
		reorderMutation.mutate({
			albumId,
			imageIds: localImageOrder,
		});
	}, [reorderMutation, albumId, localImageOrder]);

	const handleResetOrder = useCallback(() => {
		setLocalImageOrder(originalImageOrder);
	}, [originalImageOrder]);

	// Filter images that aren't already in the album
	const availableImages = useMemo(() => {
		const albumImageIds = new Set(album?.images?.map((ai) => ai.imageId) ?? []);
		return (allImagesData?.images ?? []).filter(
			(image) =>
				!albumImageIds.has(image.id) &&
				(imageSearch === '' ||
					(image.fileName?.toLowerCase() ?? '').includes(
						imageSearch.toLowerCase(),
					) ||
					(image.altText?.toLowerCase() ?? '').includes(
						imageSearch.toLowerCase(),
					)),
		);
	}, [allImagesData?.images, album?.images, imageSearch]);

	// ---------- Render ----------

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (error || !album) {
		return (
			<div className="flex flex-col items-center justify-center gap-4 py-12">
				<p className="text-destructive">
					{error?.message ?? 'Album not found'}
				</p>
				<Button asChild>
					<Link to="/images/albums">Back to Albums</Link>
				</Button>
			</div>
		);
	}

	return (
		<>
			<DashboardHeader heading={isEditing ? 'Edit Album' : album.title}>
				<div className="flex items-center justify-between pt-2">
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink asChild>
									<Link to="/images">Images</Link>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbLink asChild>
									<Link to="/images/albums">Albums</Link>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>{album.title}</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>

					<div className="flex items-center gap-4">
						{!isEditing ? (
							<Button size="sm" onClick={() => setIsEditing(true)}>
								<Pencil className="mr-2 size-4" />
								Edit Album
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
									disabled={updateAlbumMutation.isPending}
								>
									{updateAlbumMutation.isPending ? (
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
				{/* Album Info */}
				<div className="grid gap-6 lg:grid-cols-2">
					{/* Details Card */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Settings className="size-5" />
								Album Details
							</CardTitle>
							<CardDescription>
								{isEditing
									? 'Edit your album information.'
									: 'View your album information.'}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							{/* Status */}
							<div className="flex items-center justify-between gap-4">
								<div className="space-y-2">
									<Label className="text-sm font-medium text-muted-foreground">
										Status
									</Label>
									<Select
										value={album.publishStatus}
										onValueChange={handleStatusChange}
										disabled={
											publishAlbumMutation.isPending ||
											unpublishAlbumMutation.isPending ||
											archiveAlbumMutation.isPending
										}
									>
										<SelectTrigger className="w-fit">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="draft">Draft</SelectItem>
											<SelectItem value="published">Published</SelectItem>
											<SelectItem value="archived">Archived</SelectItem>
										</SelectContent>
									</Select>
									{(publishAlbumMutation.isPending ||
										unpublishAlbumMutation.isPending ||
										archiveAlbumMutation.isPending) && (
										<Loader2 className="size-4 animate-spin text-muted-foreground" />
									)}
								</div>
							</div>

							{isEditing ? (
								<>
									<div className="space-y-2">
										<Label htmlFor="title">
											Title <span className="text-destructive">*</span>
										</Label>
										<Input
											id="title"
											value={title}
											onChange={(e) => handleTitleChange(e.target.value)}
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
										<p className="text-xs text-muted-foreground">
											URL-friendly identifier. Auto-generated from the title.
										</p>
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
								</>
							) : (
								<div className="space-y-4">
									<div className="grid gap-4 sm:grid-cols-2">
										<div>
											<p className="text-sm font-medium text-muted-foreground">
												Title
											</p>
											<p>{album.title}</p>
										</div>
										<div>
											<p className="text-sm font-medium text-muted-foreground">
												Slug
											</p>
											<p className="font-mono">/{album.slug}</p>
										</div>
										<div>
											<p className="text-sm font-medium text-muted-foreground">
												Images
											</p>
											<p>{album.imageCount}</p>
										</div>
										<div>
											<p className="text-sm font-medium text-muted-foreground">
												Created
											</p>
											<p>{formatDate(album.createdAt)}</p>
										</div>
										{album.description && (
											<div className="sm:col-span-2">
												<p className="text-sm font-medium text-muted-foreground">
													Description
												</p>
												<p className="text-balance">{album.description}</p>
											</div>
										)}
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Cover Image Card */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<ImageIcon className="size-5" />
								Cover Image
							</CardTitle>
							<CardDescription>
								Choose a cover image for the album.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							{/* Cover Image Preview */}
							<div className="aspect-3/2 overflow-hidden rounded-lg border bg-muted">
								{album.coverImage ? (
									<img
										src={getImageUrlForDisplay(
											album.coverImage.id,
											album.coverImage.deliveryUrl,
											album.coverImage.requireSignedURLs,
											'md',
										)}
										alt={album.title}
										className="size-full object-cover"
									/>
								) : (
									<div className="size-full flex flex-col items-center justify-center">
										<ImageOff className="text-muted-foreground size-12" />
										No cover image is set
									</div>
								)}
							</div>
							{/* Cover image selector */}
							{albumImages.length > 0 ? (
								<div>
									<Select
										value={album.coverImageId ?? ''}
										onValueChange={(imageId) => handleSetCoverImage(imageId)}
										disabled={setCoverImageMutation.isPending}
									>
										<SelectTrigger className="w-full data-placeholder:text-primary">
											<SelectValue placeholder="Select a cover image" />
										</SelectTrigger>
										<SelectContent>
											{albumImages.map((item, index) => {
												const image = item.image;
												if (!image) return null;
												return (
													<SelectItem key={item.id} value={item.imageId}>
														#{index + 1} — {image.fileName || 'Untitled'}
													</SelectItem>
												);
											})}
										</SelectContent>
									</Select>
									{setCoverImageMutation.isPending && (
										<Loader2 className="size-4 animate-spin text-muted-foreground" />
									)}
								</div>
							) : (
								<p className="text-xs text-muted-foreground">
									No images yet. Add images to set a cover.
								</p>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Images Section */}
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="flex items-center gap-2">
									<Images className="size-5" />
									Images ({albumImages.length}/{MAX_ALBUM_IMAGES})
								</CardTitle>
								<CardDescription>
									Manage images in this album. Drag or use buttons to reorder.
									Click the star icon to set an image as the album cover.
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
											variant="accent"
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
									onClick={() => setIsAddImageOpen(true)}
									disabled={albumImages.length >= MAX_ALBUM_IMAGES}
								>
									<Plus className="mr-2 size-4" />
									Add Image
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						{albumImages.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<ImageIcon className="mb-4 size-12 text-muted-foreground" />
								<h3 className="text-lg font-semibold">No images yet</h3>
								<p className="mt-1 text-sm text-muted-foreground">
									Add images to your album to get started.
								</p>
								<Button
									variant="outline"
									className="mt-4"
									onClick={() => setIsAddImageOpen(true)}
									disabled={albumImages.length >= MAX_ALBUM_IMAGES}
								>
									<Plus className="mr-2 size-4" />
									Add First Image
								</Button>
							</div>
						) : (
							<ul className="m-0 list-none space-y-2 p-0">
								{albumImages.map((item, index) => {
									const image = item.image;
									if (!image) return null;
									const isCover = album.coverImageId === item.imageId;
									return (
										<li
											key={item.id}
											draggable
											onDragStart={(e) => handleDragStart(e, item.imageId)}
											onDragEnd={handleDragEnd}
											onDragEnter={(e) => handleDragEnter(e, item.imageId)}
											onDragLeave={handleDragLeave}
											onDragOver={handleDragOver}
											onDrop={(e) => handleDrop(e, item.imageId)}
											className={`flex items-center gap-3 rounded-lg border p-3 transition-colors bg-muted ${
												dragOverImageId === item.imageId
													? 'border-primary bg-primary/5'
													: ''
											} ${draggedImageId === item.imageId ? 'opacity-50' : ''}`}
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

											<div className="w-fit p-2 shrink-0 overflow-hidden">
												<img
													src={`${image.deliveryUrl}/thumbnail`}
													alt={image.altText || image.fileName || 'Album image'}
													className="size-full aspect-3/2 object-cover rounded-md"
												/>
											</div>

											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2">
													<Link
														to="/images/edit-image/$imageId"
														params={{ imageId: image.id }}
														className="line-clamp-1 font-medium hover:underline"
													>
														{image.fileName || 'Untitled'}
													</Link>
													{isCover && (
														<Badge variant="default" className="gap-1 text-xs">
															<Star className="size-3" />
															Cover
														</Badge>
													)}
													{image.requireSignedURLs && (
														<Badge
															variant="secondary"
															className="gap-1 text-xs"
														>
															<Lock className="size-3" />
														</Badge>
													)}
												</div>
												<p className="text-sm text-muted-foreground">
													{image.width && image.height
														? `${image.width} × ${image.height}`
														: 'Unknown size'}
													{image.altText && ` · ${image.altText}`}
												</p>
											</div>

											<div className="flex items-center gap-2">
												<Button
													variant="ghost"
													size="icon"
													onClick={() => handleMoveImage(item.imageId, 'up')}
													disabled={index === 0 || reorderMutation.isPending}
												>
													<ArrowUp className="size-6" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													onClick={() => handleMoveImage(item.imageId, 'down')}
													disabled={
														index === albumImages.length - 1 ||
														reorderMutation.isPending
													}
												>
													<ArrowDown className="size-6" />
												</Button>
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button variant="ghost" size="icon">
															<MoreHorizontal className="size-6" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuItem asChild>
															<Link
																to="/images/edit-image/$imageId"
																params={{ imageId: image.id }}
															>
																<Pencil className="mr-2 size-4" />
																Edit Image
															</Link>
														</DropdownMenuItem>
														{!isCover && (
															<DropdownMenuItem
																onClick={() =>
																	handleSetCoverImage(item.imageId)
																}
															>
																<Star className="mr-2 size-4" />
																Set as Cover
															</DropdownMenuItem>
														)}
														<DropdownMenuSeparator />
														<DropdownMenuItem
															className="text-destructive"
															onClick={() => handleRemoveImage(item.imageId)}
														>
															<Trash2 className="mr-2 size-4" />
															Remove from Album
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											</div>
										</li>
									);
								})}
							</ul>
						)}
					</CardContent>
				</Card>
				<Item variant="outline" className="lg:w-1/2 lg:ms-auto my-8">
					<ItemMedia variant="icon">
						<TriangleAlert />
					</ItemMedia>
					<ItemContent>
						<ItemTitle>Delete Album</ItemTitle>
						<ItemDescription className="line-clamp-0">
							Images will not be deleted, only the album itself. The album will
							automatically be removed from the airwartrail.com frontend
							website.
						</ItemDescription>
					</ItemContent>
					<ItemActions>
						<Button
							variant="destructive"
							onClick={() => setIsDeleteDialogOpen(true)}
						>
							<Trash2 />
							Delete Album
						</Button>
					</ItemActions>
				</Item>
			</section>

			{/* Delete Album Confirmation Dialog */}
			<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Album</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete "{album.title}"? This action
							cannot be undone. All images will be removed from the album but
							the image files will not be deleted.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsDeleteDialogOpen(false)}
							disabled={deleteAlbumMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDeleteAlbum}
							disabled={deleteAlbumMutation.isPending}
						>
							{deleteAlbumMutation.isPending ? (
								<Loader2 className="mr-2 size-4 animate-spin" />
							) : (
								<Trash2 className="mr-2 size-4" />
							)}
							Delete Album
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Add Image Dialog */}
			<Dialog open={isAddImageOpen} onOpenChange={setIsAddImageOpen}>
				<DialogContent className="max-h-[80vh] overflow-hidden lg:max-w-5xl">
					<DialogHeader>
						<DialogTitle>Add Image to Album</DialogTitle>
						<DialogDescription>
							{albumImages.length >= MAX_ALBUM_IMAGES ? (
								<span className="text-destructive">
									This album has reached the maximum of {MAX_ALBUM_IMAGES}{' '}
									images.
								</span>
							) : (
								<>
									Select images to add to this album.
									<span className="ml-1 text-muted-foreground">
										({albumImages.length} / {MAX_ALBUM_IMAGES} images)
									</span>
									{selectedImageIds.size > 0 && (
										<span className="ml-1 font-medium text-foreground">
											· {selectedImageIds.size} selected
										</span>
									)}
								</>
							)}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<Input
							placeholder="Search images..."
							value={imageSearch}
							onChange={(e) => setImageSearch(e.target.value)}
						/>

						<div className="dialog-scrollbar max-h-[50vh] overflow-y-auto">
							{availableImages.length > 0 ? (
								<ItemGroup className="mx-2 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
									{availableImages.map((image) => {
										const isSelected = selectedImageIds.has(image.id);
										const isDisabled =
											addImagesMutation.isPending ||
											(!isSelected &&
												albumImages.length + selectedImageIds.size >=
													MAX_ALBUM_IMAGES);
										return (
											<Item
												key={image.id}
												variant="outline"
												className={`relative cursor-pointer ${
													isSelected ? 'border-primary ring-1 ring-primary' : ''
												} ${isDisabled ? 'pointer-events-none opacity-50' : ''}`}
												onClick={() =>
													!isDisabled && handleToggleImageSelection(image.id)
												}
											>
												<ItemHeader>
													<img
														src={getImageUrlForDisplay(
															image.id,
															image.deliveryUrl,
															image.requireSignedURLs,
														)}
														alt={image.altText || image.fileName || 'Image'}
														className="aspect-3/2 w-full rounded-sm object-cover"
													/>
												</ItemHeader>
												<ItemContent>
													<ItemTitle>
														<span className="line-clamp-1">
															{image.fileName || 'Untitled'}
														</span>
													</ItemTitle>
													<ItemDescription>
														{image.width && image.height
															? `${image.width} × ${image.height}`
															: 'Unknown size'}
													</ItemDescription>
												</ItemContent>
												{/* Selection indicator */}
												<div className="absolute right-2 top-2">
													<Button
														size="icon"
														variant={isSelected ? 'default' : 'secondary'}
														className="size-7 rounded-full"
														onClick={(e) => {
															e.stopPropagation();
															if (!isDisabled)
																handleToggleImageSelection(image.id);
														}}
														disabled={isDisabled}
													>
														{isSelected ? (
															<Check className="size-3.5" />
														) : (
															<Plus className="size-3.5" />
														)}
													</Button>
												</div>
											</Item>
										);
									})}
								</ItemGroup>
							) : (
								<div className="py-8 text-center">
									<p className="text-sm text-muted-foreground">
										{imageSearch
											? 'No images match your search'
											: 'No more images available to add'}
									</p>
								</div>
							)}
						</div>
					</div>

					<DialogFooter className="justify-between sm:justify-between gap-2">
						<div>
							<Button
								variant="secondary"
								disabled={selectedImageIds.size === 0}
								onClick={() => setSelectedImageIds(new Set())}
							>
								Clear Selection
							</Button>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								onClick={() => {
									setIsAddImageOpen(false);
									setSelectedImageIds(new Set());
								}}
							>
								Cancel
							</Button>
							<Button
								onClick={handleAddSelectedImages}
								disabled={
									selectedImageIds.size === 0 || addImagesMutation.isPending
								}
							>
								{addImagesMutation.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<Plus className="size-4" />
								)}
								Add
								{selectedImageIds.size > 0 ? ` ${selectedImageIds.size}` : ''}{' '}
								Image{selectedImageIds.size !== 1 ? 's' : ''}
							</Button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
