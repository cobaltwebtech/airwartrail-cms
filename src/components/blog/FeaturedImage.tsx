import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Trash2 } from 'lucide-react';
import type React from 'react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';
import {
	getImageUrl,
	ImagePickerDialog,
	type SelectedImage,
} from './ImagePickerDialog';

interface FeaturedImageProps {
	postId: string;
	currentImageUrl: string | null;
	currentImageAlt: string | null;
	onImageUploaded: (url: string) => void;
	onImageDeleted: () => void;
	onAltTextChange: (alt: string) => void;
	disabled?: boolean;
}

const FeaturedImage: React.FC<FeaturedImageProps> = ({
	postId,
	currentImageUrl,
	currentImageAlt,
	onImageUploaded,
	onImageDeleted,
	onAltTextChange,
	disabled = false,
}) => {
	const queryClient = useQueryClient();
	const [isPickerOpen, setIsPickerOpen] = useState(false);
	const [altText, setAltText] = useState(currentImageAlt || '');

	// Set featured image mutation
	const setImageMutation = useMutation(
		trpc.blog.setFeaturedImage.mutationOptions({
			onSuccess: (data) => {
				toast.success('Featured image set');
				onImageUploaded(data.featuredImageUrl);
				queryClient.invalidateQueries({
					queryKey: trpc.blog.get.queryKey({ id: postId }),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.blog.list.queryKey(),
				});
				setIsPickerOpen(false);
			},
			onError: (err) => {
				const errorMessage =
					err instanceof Error ? err.message : 'Unknown error';
				toast.error('Failed to set featured image', {
					description: errorMessage,
				});
			},
		}),
	);

	// Delete mutation
	const deleteMutation = useMutation(
		trpc.blog.removeFeaturedImage.mutationOptions({
			onSuccess: () => {
				toast.success('Featured image removed');
				onImageDeleted();
				queryClient.invalidateQueries({
					queryKey: trpc.blog.get.queryKey({ id: postId }),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.blog.list.queryKey(),
				});
			},
			onError: (err) => {
				const errorMessage =
					err instanceof Error ? err.message : 'Unknown error';
				toast.error('Failed to remove featured image', {
					description: errorMessage,
				});
			},
		}),
	);

	const handleImageSelected = useCallback(
		(image: SelectedImage) => {
			// Build the public URL using the "md" variant (public override, no signature needed)
			const featuredImageUrl = getImageUrl(image.deliveryUrl, 'md');
			setImageMutation.mutate({ postId, featuredImageUrl });
		},
		[postId, setImageMutation],
	);

	const handleDelete = useCallback(() => {
		deleteMutation.mutate({ postId });
	}, [postId, deleteMutation]);

	const handleAltTextChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			setAltText(value);
			onAltTextChange(value);
		},
		[onAltTextChange],
	);

	// Swap 'md' variant to 'thumbnail' for a smaller preview image
	const previewImageUrl =
		currentImageUrl?.replace(/\/md$/, '/thumbnail') ?? null;
	const hasExistingImage = !!currentImageUrl;
	const isAnyMutationPending =
		setImageMutation.isPending || deleteMutation.isPending;

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Featured Image</CardTitle>
					<CardDescription>
						Select a featured image from your image library.
					</CardDescription>
					{hasExistingImage && (
						<CardAction>
							<Button
								size="sm"
								variant="destructive"
								onClick={handleDelete}
								disabled={isAnyMutationPending || disabled}
							>
								<Trash2 className="size-4" />
								{deleteMutation.isPending ? 'Removing...' : 'Remove'}
							</Button>
						</CardAction>
					)}
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Image preview area */}
					<div className="relative aspect-3/2 w-full overflow-hidden rounded-lg border bg-muted">
						{hasExistingImage ? (
							<img
								src={previewImageUrl ?? currentImageUrl}
								alt={currentImageAlt || 'Featured image'}
								className="size-full object-cover"
								onError={(e) => {
									e.currentTarget.style.display = 'none';
								}}
							/>
						) : (
							<div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
								<ImagePlus className="size-12" />
								<p className="text-sm">No featured image set</p>
							</div>
						)}
					</div>

					{/* Select image button */}
					<Button
						onClick={() => setIsPickerOpen(true)}
						className="w-full"
						disabled={isAnyMutationPending || disabled}
					>
						<ImagePlus className="size-4" />
						{hasExistingImage ? 'Replace Image' : 'Select Image'}
					</Button>

					{/* Alt text input */}
					<div className="space-y-2">
						<Label htmlFor="featuredImageAlt">Alt Text</Label>
						<Input
							id="featuredImageAlt"
							value={altText}
							onChange={handleAltTextChange}
							placeholder="Describe the image for accessibility"
							disabled={disabled}
						/>
						<p className="text-xs text-muted-foreground">
							Describe the image for screen readers and SEO.
						</p>
					</div>
				</CardContent>
			</Card>

			<ImagePickerDialog
				open={isPickerOpen}
				onOpenChange={setIsPickerOpen}
				onSelect={handleImageSelected}
				title="Select Featured Image"
				description="Choose an image from your library to use as the featured image."
				confirmDisabled={setImageMutation.isPending}
			/>
		</>
	);
};

export default FeaturedImage;
