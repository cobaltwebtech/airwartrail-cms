import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Trash2, Upload, X } from 'lucide-react';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
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

interface FeaturedImageProps {
	postId: string;
	currentImageUrl: string | null;
	currentImageAlt: string | null;
	onImageUploaded: (url: string) => void;
	onImageDeleted: () => void;
	onAltTextChange: (alt: string) => void;
	disabled?: boolean;
}

const ALLOWED_TYPES = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
	'image/avif',
] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

type AllowedMimeType = (typeof ALLOWED_TYPES)[number];

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
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [altText, setAltText] = useState(currentImageAlt || '');

	// Upload mutation
	const uploadMutation = useMutation(
		trpc.blog.uploadFeaturedImage.mutationOptions({
			onSuccess: (data) => {
				toast.success('Featured image uploaded successfully');
				// Clear preview and selected file
				setPreviewUrl(null);
				setSelectedFile(null);
				// Notify parent of the new URL
				onImageUploaded(data.featuredImageUrl);
				// Invalidate queries to refresh data
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
				toast.error('Failed to upload featured image', {
					description: errorMessage,
				});
				console.error('Upload featured image error:', errorMessage);
			},
			onSettled: () => {
				setIsUploading(false);
			},
		}),
	);

	// Delete mutation
	const deleteMutation = useMutation(
		trpc.blog.deleteFeaturedImage.mutationOptions({
			onSuccess: () => {
				toast.success('Featured image removed');
				// Notify parent
				onImageDeleted();
				// Invalidate queries to refresh data
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
				console.error('Delete featured image error:', errorMessage);
			},
		}),
	);

	const handleFileSelect = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (!file) return;

			// Validate file type
			if (!ALLOWED_TYPES.includes(file.type as AllowedMimeType)) {
				toast.error('Invalid file type', {
					description: 'Please upload a JPEG, PNG, WebP, GIF, or AVIF image.',
				});
				return;
			}

			// Validate file size
			if (file.size > MAX_FILE_SIZE) {
				toast.error('File too large', {
					description: 'Please upload an image smaller than 5MB.',
				});
				return;
			}

			setSelectedFile(file);

			// Create preview URL
			const url = URL.createObjectURL(file);
			setPreviewUrl(url);
		},
		[],
	);

	const handleUpload = useCallback(async () => {
		if (!selectedFile) return;

		setIsUploading(true);

		try {
			// Convert file to base64
			const reader = new FileReader();
			reader.onload = async () => {
				const base64 = reader.result as string;
				// Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
				const base64Data = base64.split(',')[1];

				if (!base64Data) {
					toast.error('Failed to read file');
					setIsUploading(false);
					return;
				}

				uploadMutation.mutate({
					postId,
					fileName: selectedFile.name,
					imageData: base64Data,
					mimeType: selectedFile.type as AllowedMimeType,
				});
			};
			reader.onerror = () => {
				toast.error('Failed to read file');
				setIsUploading(false);
			};
			reader.readAsDataURL(selectedFile);
		} catch (error) {
			console.error('Error reading file:', error);
			toast.error('Failed to process file');
			setIsUploading(false);
		}
	}, [selectedFile, postId, uploadMutation]);

	const handleCancelPreview = useCallback(() => {
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}
		setPreviewUrl(null);
		setSelectedFile(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
	}, [previewUrl]);

	const handleDelete = useCallback(() => {
		deleteMutation.mutate({ postId });
	}, [postId, deleteMutation]);

	const handleSelectFile = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const handleAltTextChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			setAltText(value);
			onAltTextChange(value);
		},
		[onAltTextChange],
	);

	const hasExistingImage = !!currentImageUrl;
	const isAnyMutationPending =
		uploadMutation.isPending || deleteMutation.isPending || isUploading;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Featured Image</CardTitle>
				<CardDescription>
					Upload a featured image for this post. Supports JPEG, PNG, WebP, GIF,
					and AVIF formats (max 5MB).
				</CardDescription>
				{hasExistingImage && !previewUrl && (
					<CardAction>
						<Button
							size="sm"
							variant="destructive"
							onClick={handleDelete}
							disabled={deleteMutation.isPending || disabled}
						>
							<Trash2 className="size-4" />
							{deleteMutation.isPending ? 'Removing...' : 'Remove'}
						</Button>
					</CardAction>
				)}
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Hidden file input */}
				<input
					ref={fileInputRef}
					type="file"
					accept={ALLOWED_TYPES.join(',')}
					onChange={handleFileSelect}
					className="hidden"
					disabled={disabled}
				/>

				{/* Image preview area */}
				<div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
					{previewUrl ? (
						// Show new file preview
						<>
							<img
								src={previewUrl}
								alt="Featured content preview"
								className="h-full w-full object-cover"
							/>
							<div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100">
								<Button
									size="sm"
									variant="secondary"
									onClick={handleCancelPreview}
									disabled={isAnyMutationPending}
								>
									<X className="size-4" />
									Cancel
								</Button>
							</div>
						</>
					) : hasExistingImage ? (
						// Show existing image
						<img
							src={currentImageUrl}
							alt={currentImageAlt || 'Featured image'}
							className="h-full w-full object-cover"
							onError={(e) => {
								e.currentTarget.style.display = 'none';
							}}
						/>
					) : (
						// Show placeholder
						<div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
							<ImagePlus className="size-12" />
							<p className="text-sm">No featured image set</p>
						</div>
					)}
				</div>

				{/* Action buttons */}
				<div className="flex gap-2">
					{previewUrl ? (
						// Preview mode: show upload and cancel buttons
						<>
							<Button
								onClick={handleUpload}
								disabled={isAnyMutationPending || disabled}
								className="flex-1"
							>
								<Upload className="size-4" />
								{isUploading || uploadMutation.isPending
									? 'Uploading...'
									: 'Upload Image'}
							</Button>
							<Button
								variant="outline"
								onClick={handleCancelPreview}
								disabled={isAnyMutationPending || disabled}
							>
								<X className="size-4" />
								Cancel
							</Button>
						</>
					) : (
						// Normal mode: show select file button
						<Button
							onClick={handleSelectFile}
							className="w-full"
							disabled={disabled}
						>
							<ImagePlus className="size-4" />
							{hasExistingImage ? 'Replace Image' : 'Select Image'}
						</Button>
					)}
				</div>

				{/* File info when selected */}
				{selectedFile && (
					<p className="text-xs text-muted-foreground">
						Selected: {selectedFile.name} (
						{(selectedFile.size / 1024).toFixed(1)} KB)
					</p>
				)}

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
	);
};

export default FeaturedImage;
