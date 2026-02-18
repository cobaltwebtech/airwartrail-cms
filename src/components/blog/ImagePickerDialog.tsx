import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemHeader,
	ItemTitle,
} from '@/components/ui/item';
import { trpc } from '@/lib/trpc';

// Build image URL with variant
export function getImageUrl(deliveryUrl: string, variant = 'md'): string {
	return `${deliveryUrl}/${variant}`;
}

/** Shape returned to the consumer when an image is confirmed. */
export interface SelectedImage {
	/** Internal image record ID */
	id: string;
	/** Base Cloudflare Images delivery URL (no variant appended) */
	deliveryUrl: string;
	/** Alt text stored in the image library */
	altText: string | null;
	/** Original file name */
	fileName: string | null;
}

interface ImagePickerDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Called when the user confirms their selection. */
	onSelect: (image: SelectedImage) => void;
	/** Optional title override */
	title?: string;
	/** Optional description override */
	description?: string;
	/** Disable the confirm button (e.g. while a parent mutation is pending) */
	confirmDisabled?: boolean;
	/** Label for the confirm button */
	confirmLabel?: string;
}

export function ImagePickerDialog({
	open,
	onOpenChange,
	onSelect,
	title = 'Select Image',
	description = 'Choose an image from your library.',
	confirmDisabled = false,
	confirmLabel = 'Select Image',
}: ImagePickerDialogProps) {
	const [imageSearch, setImageSearch] = useState('');
	const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

	// Fetch images only while the dialog is open
	const { data: allImagesData } = useQuery({
		...trpc.cfImages.images.listImages.queryOptions({
			limit: 100,
			page: 1,
			sortOrder: 'desc',
		}),
		enabled: open,
	});

	// Filter images by search
	const filteredImages = useMemo(() => {
		const images = allImagesData?.images ?? [];
		if (!imageSearch) return images;
		const query = imageSearch.toLowerCase();
		return images.filter(
			(image) =>
				(image.fileName?.toLowerCase() ?? '').includes(query) ||
				(image.altText?.toLowerCase() ?? '').includes(query),
		);
	}, [allImagesData?.images, imageSearch]);

	// Resolve the full selected image object
	const selectedImage = useMemo(() => {
		if (!selectedImageId) return null;
		return (
			(allImagesData?.images ?? []).find((img) => img.id === selectedImageId) ??
			null
		);
	}, [selectedImageId, allImagesData?.images]);

	const handleConfirm = () => {
		if (!selectedImage) return;
		onSelect({
			id: selectedImage.id,
			// Store base URL without variant - variants will be applied contextually
			deliveryUrl: selectedImage.deliveryUrl,
			altText: selectedImage.altText ?? null,
			fileName: selectedImage.fileName ?? null,
		});
		// Reset local state immediately so stale selection doesn't persist
		setSelectedImageId(null);
		setImageSearch('');
	};

	const handleOpenChange = (nextOpen: boolean) => {
		onOpenChange(nextOpen);
		if (!nextOpen) {
			setSelectedImageId(null);
			setImageSearch('');
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-h-[80vh] overflow-hidden lg:max-w-5xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<Input
						placeholder="Search images..."
						value={imageSearch}
						onChange={(e) => setImageSearch(e.target.value)}
					/>

					<div className="dialog-scrollbar max-h-[50vh] overflow-y-auto">
						{filteredImages.length > 0 ? (
							<ItemGroup className="mx-2 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
								{filteredImages.map((image) => {
									const isSelected = selectedImageId === image.id;
									return (
										<Item
											key={image.id}
											variant="outline"
											className={`relative cursor-pointer ${
												isSelected ? 'border-primary ring-1 ring-primary' : ''
											}`}
											onClick={() =>
												setSelectedImageId(isSelected ? null : image.id)
											}
										>
											<ItemHeader>
												<img
													src={getImageUrl(image.deliveryUrl, 'thumbnail')}
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
											{isSelected && (
												<div className="absolute right-2 top-2">
													<Button
														size="icon"
														variant="default"
														className="size-7 rounded-full"
														onClick={(e) => {
															e.stopPropagation();
															setSelectedImageId(null);
														}}
													>
														<Check className="size-3.5" />
													</Button>
												</div>
											)}
										</Item>
									);
								})}
							</ItemGroup>
						) : (
							<div className="py-8 text-center">
								<p className="text-sm text-muted-foreground">
									{imageSearch
										? 'No images match your search'
										: 'No images available'}
								</p>
							</div>
						)}
					</div>
				</div>

				<DialogFooter className="justify-between sm:justify-between gap-2">
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={handleConfirm}
						disabled={!selectedImageId || confirmDisabled}
					>
						<Check className="size-4" />
						{confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
