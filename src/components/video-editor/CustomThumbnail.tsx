import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, ImagePlus, Save, Trash2, Upload, X } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
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
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';

interface CustomThumbnailProps {
	videoId: string;
	libraryId: string;
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

const CustomThumbnail: React.FC<CustomThumbnailProps> = ({
	videoId,
	libraryId,
}) => {
	const queryClient = useQueryClient();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [thumbnailTime, setThumbnailTime] = useState<string>('');

	// Fetch current thumbnail data
	const { data: thumbnailData, isLoading: isLoadingThumbnail } = useQuery(
		trpc.mux.getThumbnail.queryOptions(
			{ videoId, libraryId },
			{ enabled: !!videoId && !!libraryId },
		),
	);

	// Upload mutation
	const uploadMutation = useMutation(
		trpc.mux.uploadThumbnail.mutationOptions({
			onSuccess: () => {
				toast.success('Thumbnail uploaded successfully');
				// Clear preview and selected file
				setPreviewUrl(null);
				setSelectedFile(null);
				// Invalidate queries to refresh data
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getThumbnail']],
				});
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getVideoById']],
				});
			},
			onError: (err) => {
				const errorMessage =
					err instanceof Error ? err.message : 'Unknown error';
				toast.error('Failed to upload thumbnail', {
					description: errorMessage,
				});
				console.error('Upload thumbnail error:', errorMessage);
			},
			onSettled: () => {
				setIsUploading(false);
			},
		}),
	);

	// Delete mutation
	const deleteMutation = useMutation(
		trpc.mux.deleteThumbnail.mutationOptions({
			onSuccess: () => {
				toast.success('Thumbnail removed');
				// Invalidate queries to refresh data
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getThumbnail']],
				});
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getVideoById']],
				});
			},
			onError: (err) => {
				const errorMessage =
					err instanceof Error ? err.message : 'Unknown error';
				toast.error('Failed to remove thumbnail', {
					description: errorMessage,
				});
				console.error('Delete thumbnail error:', errorMessage);
			},
		}),
	);

	// Update thumbnail time mutation
	const updateTimeMutation = useMutation(
		trpc.mux.updateThumbnailTime.mutationOptions({
			onSuccess: () => {
				toast.success('Thumbnail time updated');
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getThumbnail']],
				});
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getVideoById']],
				});
			},
			onError: (err) => {
				const errorMessage =
					err instanceof Error ? err.message : 'Unknown error';
				toast.error('Failed to update thumbnail time', {
					description: errorMessage,
				});
				console.error('Update thumbnail time error:', errorMessage);
			},
		}),
	);

	// Sync thumbnail time state when data loads
	useEffect(() => {
		if (thumbnailData?.customThumbnailTime !== undefined) {
			setThumbnailTime(
				thumbnailData.customThumbnailTime !== null
					? String(thumbnailData.customThumbnailTime)
					: '',
			);
		}
	}, [thumbnailData?.customThumbnailTime]);

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
					videoId,
					libraryId,
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
	}, [selectedFile, videoId, libraryId, uploadMutation]);

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
		deleteMutation.mutate({ videoId, libraryId });
	}, [videoId, libraryId, deleteMutation]);

	const handleSelectFile = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const handleSaveThumbnailTime = useCallback(() => {
		const timeValue = thumbnailTime.trim();
		const numericTime = timeValue === '' ? null : Number.parseFloat(timeValue);

		// Validate the input
		if (
			numericTime !== null &&
			(Number.isNaN(numericTime) || numericTime < 0)
		) {
			toast.error('Invalid time value', {
				description: 'Please enter a valid positive number in seconds.',
			});
			return;
		}

		updateTimeMutation.mutate({
			videoId,
			libraryId,
			thumbnailTime: numericTime,
		});
	}, [thumbnailTime, videoId, libraryId, updateTimeMutation]);

	const handleClearThumbnailTime = useCallback(() => {
		setThumbnailTime('');
		updateTimeMutation.mutate({
			videoId,
			libraryId,
			thumbnailTime: null,
		});
	}, [videoId, libraryId, updateTimeMutation]);

	const hasExistingThumbnail = thumbnailData?.hasCustomThumbnail;
	const currentThumbnailTime = thumbnailData?.customThumbnailTime;
	const hasTimeChanged =
		(thumbnailTime === '' && currentThumbnailTime !== null) ||
		(thumbnailTime !== '' &&
			Number.parseFloat(thumbnailTime) !== currentThumbnailTime);
	const existingThumbnailUrl = thumbnailData?.customThumbnailUrl;

	return (
		<Card className="col-span-3">
			<CardHeader>
				<CardTitle>Custom Thumbnail</CardTitle>
				<CardDescription>
					Upload a custom thumbnail image for this video. Supports JPEG, PNG,
					WebP, GIF, and AVIF formats (max 5MB).
				</CardDescription>
				{hasExistingThumbnail && !previewUrl && (
					<CardAction>
						<Button
							size="sm"
							variant="destructive"
							onClick={handleDelete}
							disabled={deleteMutation.isPending}
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
				/>

				{/* Thumbnail preview area */}
				<div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
					{isLoadingThumbnail ? (
						<Skeleton className="h-full w-full" />
					) : previewUrl ? (
						// Show new file preview
						<>
							<img
								src={previewUrl}
								alt="Thumbnail preview"
								className="h-full w-full object-cover"
							/>
							<div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100">
								<Button
									size="sm"
									variant="secondary"
									onClick={handleCancelPreview}
								>
									<X className="size-4" />
									Cancel
								</Button>
							</div>
						</>
					) : hasExistingThumbnail && existingThumbnailUrl ? (
						// Show existing thumbnail
						<img
							src={existingThumbnailUrl}
							alt="Current thumbnail"
							className="h-full w-full object-cover"
						/>
					) : (
						// Show placeholder
						<div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
							<ImagePlus className="size-12" />
							<p className="text-sm">No custom thumbnail set</p>
							<p className="text-xs">
								Using auto-generated thumbnail from video
							</p>
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
								disabled={isUploading || uploadMutation.isPending}
								className="flex-1"
							>
								<Upload className="size-4" />
								{isUploading || uploadMutation.isPending
									? 'Uploading...'
									: 'Upload Thumbnail'}
							</Button>
							<Button
								variant="outline"
								onClick={handleCancelPreview}
								disabled={isUploading || uploadMutation.isPending}
							>
								<X className="size-4" />
								Cancel
							</Button>
						</>
					) : (
						// Normal mode: show select file button
						<Button onClick={handleSelectFile} className="w-full">
							<ImagePlus className="size-4" />
							{hasExistingThumbnail ? 'Replace Thumbnail' : 'Select Image'}
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

				<div className="my-4 flex items-center gap-2">
					<Separator className="flex-1 bg-primary" />
					<Badge variant="outline">OR</Badge>
					<Separator className="flex-1 bg-primary" />
				</div>

				{/* Thumbnail time input for Mux auto-generated thumbnails */}
				<div className="space-y-3">
					<div className="flex items-center gap-2">
						<Clock className="size-4 text-muted-foreground" />
						<Label htmlFor="thumbnail-time" className="text-sm font-medium">
							Auto-Generated Thumbnail Time
						</Label>
					</div>
					<p className="text-xs text-muted-foreground">
						Specify a time in seconds to generate a thumbnail snapshot image
						from the video. Leave empty to use the default. You may use decimal
						values for more precise timing.
					</p>
					<p className="text-xs text-muted-foreground">
						Note: If a custom thumbnail image is set it will take priority over
						the time setting and will be ignored. Remove the custom thumbnail to
						use the auto-generated value.
					</p>
					<div className="flex gap-2">
						<Input
							id="thumbnail-time"
							type="number"
							min="0"
							step="1"
							placeholder="Enter time in seconds"
							value={thumbnailTime}
							onChange={(e) => setThumbnailTime(e.target.value)}
						/>
						<Button
							size="sm"
							onClick={handleSaveThumbnailTime}
							disabled={updateTimeMutation.isPending || !hasTimeChanged}
						>
							<Save className="size-4" />
							{updateTimeMutation.isPending ? 'Saving...' : 'Save'}
						</Button>
						{currentThumbnailTime !== null &&
							currentThumbnailTime !== undefined && (
								<Button
									size="sm"
									variant="outline"
									onClick={handleClearThumbnailTime}
									disabled={updateTimeMutation.isPending}
								>
									<X className="size-4" />
									Clear
								</Button>
							)}
					</div>
					{currentThumbnailTime !== null &&
						currentThumbnailTime !== undefined && (
							<p className="text-xs text-muted-foreground">
								Current: {currentThumbnailTime} seconds
							</p>
						)}
				</div>
			</CardContent>
		</Card>
	);
};

export default CustomThumbnail;
