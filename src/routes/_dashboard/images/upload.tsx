import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
	AlertCircle,
	ArrowLeft,
	CheckCircle,
	FileImage,
	GlobeLock,
	Loader2,
	Upload,
	X,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_dashboard/images/upload')({
	component: ImageUploadPage,
});

// Cloudflare Images limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_DIMENSION = 12000; // 12,000 pixels
const MAX_AREA = 100_000_000; // 100 megapixels
const SUPPORTED_FORMATS = [
	'image/png',
	'image/jpeg',
	'image/gif',
	'image/webp',
	'image/svg+xml',
	'image/heic',
	'image/heif',
];
const SUPPORTED_EXTENSIONS = [
	'png',
	'jpg',
	'jpeg',
	'gif',
	'webp',
	'svg',
	'heic',
	'heif',
];

interface FileWithPreview {
	file: File;
	id: string;
	preview: string;
	status: 'pending' | 'uploading' | 'success' | 'error';
	error?: string;
	progress: number;
	altText: string;
	requireSignedURLs: boolean;
	width?: number;
	height?: number;
}

function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

function validateFile(file: File): { valid: boolean; error?: string } {
	// Check file type
	if (!SUPPORTED_FORMATS.includes(file.type)) {
		const ext = file.name.split('.').pop()?.toLowerCase();
		if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
			return {
				valid: false,
				error: `Unsupported format. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`,
			};
		}
	}

	// Check file size
	if (file.size > MAX_FILE_SIZE) {
		return {
			valid: false,
			error: `File too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`,
		};
	}

	return { valid: true };
}

async function getImageDimensions(
	file: File,
): Promise<{ width: number; height: number } | null> {
	return new Promise((resolve) => {
		if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
			resolve(null);
			return;
		}

		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve({ width: img.naturalWidth, height: img.naturalHeight });
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			resolve(null);
		};

		img.src = url;
	});
}

async function validateImageDimensions(file: File): Promise<{
	valid: boolean;
	error?: string;
	width?: number;
	height?: number;
}> {
	const dimensions = await getImageDimensions(file);

	if (!dimensions) {
		return { valid: true }; // Can't validate, let CF handle it
	}

	const { width, height } = dimensions;

	if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
		return {
			valid: false,
			error: `Dimension exceeds ${MAX_DIMENSION.toLocaleString()}px limit (${width}×${height})`,
		};
	}

	if (width * height > MAX_AREA) {
		return {
			valid: false,
			error: `Image area exceeds 100 megapixels (${((width * height) / 1_000_000).toFixed(1)}MP)`,
		};
	}

	return { valid: true, width, height };
}

function ImageUploadPage() {
	const queryClient = useQueryClient();
	const [files, setFiles] = useState<FileWithPreview[]>([]);
	const [isDragActive, setIsDragActive] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [globalRequireSignedURLs, setGlobalRequireSignedURLs] = useState(true);
	const [uploadProgress, setUploadProgress] = useState(0);

	// Mutations
	const createDirectUploadMutation = useMutation(
		trpc.cfImages.api.createDirectUploadUrl.mutationOptions(),
	);

	const confirmDirectUploadMutation = useMutation(
		trpc.cfImages.api.confirmDirectUpload.mutationOptions(),
	);

	const handleDragEnter = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragActive(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragActive(false);
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	}, []);

	const processFiles = useCallback(
		async (fileList: FileList | File[]) => {
			const newFiles: FileWithPreview[] = [];

			for (const file of Array.from(fileList)) {
				const validation = validateFile(file);
				if (!validation.valid) {
					toast.error(`${file.name}: ${validation.error}`);
					continue;
				}

				const dimensionValidation = await validateImageDimensions(file);
				if (!dimensionValidation.valid) {
					toast.error(`${file.name}: ${dimensionValidation.error}`);
					continue;
				}

				const preview = URL.createObjectURL(file);
				newFiles.push({
					file,
					id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
					preview,
					status: 'pending',
					progress: 0,
					altText: '',
					requireSignedURLs: globalRequireSignedURLs,
					width: dimensionValidation.width,
					height: dimensionValidation.height,
				});
			}

			setFiles((prev) => [...prev, ...newFiles]);
		},
		[globalRequireSignedURLs],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragActive(false);

			const { files: droppedFiles } = e.dataTransfer;
			if (droppedFiles?.length) {
				processFiles(droppedFiles);
			}
		},
		[processFiles],
	);

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const { files: selectedFiles } = e.target;
			if (selectedFiles?.length) {
				processFiles(selectedFiles);
			}
			// Reset input to allow selecting the same file again
			e.target.value = '';
		},
		[processFiles],
	);

	const removeFile = useCallback((id: string) => {
		setFiles((prev) => {
			const file = prev.find((f) => f.id === id);
			if (file) {
				URL.revokeObjectURL(file.preview);
			}
			return prev.filter((f) => f.id !== id);
		});
	}, []);

	const updateFileAltText = useCallback((id: string, altText: string) => {
		setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, altText } : f)));
	}, []);

	const updateFileSignedUrls = useCallback(
		(id: string, requireSignedURLs: boolean) => {
			setFiles((prev) =>
				prev.map((f) => (f.id === id ? { ...f, requireSignedURLs } : f)),
			);
		},
		[],
	);

	const uploadSingleFile = async (fileData: FileWithPreview): Promise<void> => {
		// Update status to uploading
		setFiles((prev) =>
			prev.map((f) =>
				f.id === fileData.id ? { ...f, status: 'uploading', progress: 10 } : f,
			),
		);

		try {
			// Step 1: Get direct upload URL from our API
			const { uploadURL, id: cfImageId } =
				await createDirectUploadMutation.mutateAsync({
					requireSignedURLs: fileData.requireSignedURLs,
				});

			setFiles((prev) =>
				prev.map((f) => (f.id === fileData.id ? { ...f, progress: 30 } : f)),
			);

			// Step 2: Upload directly to Cloudflare
			const formData = new FormData();
			formData.append('file', fileData.file);

			const uploadResponse = await fetch(uploadURL, {
				method: 'POST',
				body: formData,
			});

			if (!uploadResponse.ok) {
				throw new Error('Failed to upload to Cloudflare');
			}

			setFiles((prev) =>
				prev.map((f) => (f.id === fileData.id ? { ...f, progress: 70 } : f)),
			);

			// Step 3: Confirm upload and save to our database
			await confirmDirectUploadMutation.mutateAsync({
				cfImageId,
				fileName: fileData.file.name,
				altText: fileData.altText || undefined,
				width: fileData.width,
				height: fileData.height,
			});

			setFiles((prev) =>
				prev.map((f) =>
					f.id === fileData.id ? { ...f, status: 'success', progress: 100 } : f,
				),
			);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Upload failed';
			setFiles((prev) =>
				prev.map((f) =>
					f.id === fileData.id
						? { ...f, status: 'error', error: errorMessage, progress: 0 }
						: f,
				),
			);
		}
	};

	const handleUploadAll = async () => {
		const pendingFiles = files.filter((f) => f.status === 'pending');
		if (pendingFiles.length === 0) {
			toast.info('No files to upload');
			return;
		}

		setIsUploading(true);
		setUploadProgress(0);

		// Upload files sequentially to avoid rate limiting
		for (let i = 0; i < pendingFiles.length; i++) {
			await uploadSingleFile(pendingFiles[i]);
			setUploadProgress(((i + 1) / pendingFiles.length) * 100);
		}

		setIsUploading(false);
		setUploadProgress(0);

		// Invalidate the images list to refetch
		queryClient.invalidateQueries({
			queryKey: [['cfImages', 'images', 'listImages']],
		});

		const successCount = files.filter((f) => f.status === 'success').length;
		const errorCount = files.filter((f) => f.status === 'error').length;

		if (successCount > 0 && errorCount === 0) {
			toast.success(
				`Successfully uploaded ${successCount} image${successCount > 1 ? 's' : ''}`,
			);
		} else if (successCount > 0 && errorCount > 0) {
			toast.warning(
				`Uploaded ${successCount} image${successCount > 1 ? 's' : ''}, ${errorCount} failed`,
			);
		} else if (errorCount > 0) {
			toast.error(
				`Failed to upload ${errorCount} image${errorCount > 1 ? 's' : ''}`,
			);
		}
	};

	const clearCompleted = useCallback(() => {
		setFiles((prev) => {
			for (const file of prev.filter((f) => f.status === 'success')) {
				URL.revokeObjectURL(file.preview);
			}
			return prev.filter((f) => f.status !== 'success');
		});
	}, []);

	const clearAll = useCallback(() => {
		for (const file of files) {
			URL.revokeObjectURL(file.preview);
		}
		setFiles([]);
	}, [files]);

	const pendingCount = files.filter((f) => f.status === 'pending').length;
	const successCount = files.filter((f) => f.status === 'success').length;
	const errorCount = files.filter((f) => f.status === 'error').length;

	return (
		<>
			<DashboardHeader
				heading="Upload Images"
				text="Upload images to your Cloudflare Images library."
			>
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink href="/images">
								<ArrowLeft className="mr-1 inline size-4" />
								Back to Images
							</BreadcrumbLink>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</DashboardHeader>

			<section className="my-4 space-y-6">
				{/* Limits Info */}
				<Alert>
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Supported Image Formats:</AlertTitle>
					<AlertDescription>
						<ul className="mt-2 list-inside list-disc space-y-1 text-sm">
							<li>
								<strong>Formats:</strong> PNG, JPEG, GIF, WebP, SVG, HEIC
							</li>
							<li>
								<strong>Max file size:</strong> 10 MB
							</li>
							<li>
								<strong>Max dimension:</strong> 12,000 pixels
							</li>
							<li>
								<strong>Max area:</strong> 100 megapixels (e.g., 10,000×10,000)
							</li>
							<li>
								<strong>Animated GIF/WebP:</strong> Max 50 megapixels total
							</li>
						</ul>
					</AlertDescription>
				</Alert>

				{/* Global Settings */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<GlobeLock className="size-6" />
							<h3>Signed URL Setting</h3>
						</CardTitle>
						<CardDescription>
							A signed URL for an image provides an extra layer of security by
							requring a valid signature with an expiration (usually one hour).
							If a user shares the image URL, it will only be accessible until
							the signature expires. Enabling this will apply to all uploaded
							images. This setting can be changed for each image individually in
							the image editor after upload.
						</CardDescription>
					</CardHeader>
					<CardContent className="pt-6">
						<div className="flex items-center space-x-2">
							<Switch
								id="globalSignedUrls"
								checked={globalRequireSignedURLs}
								onCheckedChange={(checked) =>
									setGlobalRequireSignedURLs(checked === true)
								}
							/>
							<Label htmlFor="globalSignedUrls">Signed URL Setting</Label>
						</div>
					</CardContent>
				</Card>

				{/* Drop Zone */}
				<label
					htmlFor="file-input"
					onDragEnter={handleDragEnter}
					onDragLeave={handleDragLeave}
					onDragOver={handleDragOver}
					onDrop={handleDrop}
					className={`relative block cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
						isDragActive
							? 'border-primary bg-primary/5'
							: 'border-muted-foreground/25 hover:border-muted-foreground/50'
					}`}
				>
					<input
						type="file"
						id="file-input"
						multiple
						accept={SUPPORTED_FORMATS.join(',')}
						onChange={handleFileSelect}
						className="sr-only"
					/>
					<div className="flex flex-col items-center gap-4">
						<div className="rounded-full bg-muted p-4">
							<Upload className="h-8 w-8 text-muted-foreground" />
						</div>
						<div>
							<p className="text-lg font-medium">
								{isDragActive
									? 'Drop images here...'
									: 'Drag and drop images here'}
							</p>
							<p className="text-muted-foreground text-sm">
								or click to browse your files
							</p>
						</div>
						<span className="inline-flex items-center justify-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground shadow-xs">
							<FileImage className="h-4 w-4" />
							Select Images
						</span>
					</div>
				</label>

				{/* File Queue */}
				{files.length > 0 && (
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-4">
								<h3 className="text-lg font-semibold">
									Upload Queue ({files.length})
								</h3>
								<div className="flex gap-2">
									{pendingCount > 0 && (
										<Badge variant="secondary">{pendingCount} pending</Badge>
									)}
									{successCount > 0 && (
										<Badge variant="default">{successCount} uploaded</Badge>
									)}
									{errorCount > 0 && (
										<Badge variant="destructive">{errorCount} failed</Badge>
									)}
								</div>
							</div>
							<div className="flex gap-2">
								{successCount > 0 && (
									<Button variant="outline" size="sm" onClick={clearCompleted}>
										Clear Completed
									</Button>
								)}
								<Button variant="outline" size="sm" onClick={clearAll}>
									Clear All
								</Button>
								<Button
									onClick={handleUploadAll}
									disabled={isUploading || pendingCount === 0}
								>
									{isUploading ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Uploading...
										</>
									) : (
										<>
											<Upload className="mr-2 h-4 w-4" />
											Upload {pendingCount > 0 ? `(${pendingCount})` : 'All'}
										</>
									)}
								</Button>
								{successCount > 0 && pendingCount === 0 && (
									<Button asChild>
										<Link to="/images">Go to Image Library</Link>
									</Button>
								)}
							</div>
						</div>

						{/* Global Upload Progress */}
						{isUploading && (
							<div className="space-y-2">
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">Upload Progress</span>
									<span className="font-medium">
										{Math.round(uploadProgress)}%
									</span>
								</div>
								<Progress value={uploadProgress} className="h-2" />
							</div>
						)}

						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{files.map((fileData) => (
								<Card key={fileData.id} className="overflow-hidden">
									<div className="relative aspect-3/2 bg-muted">
										<img
											src={fileData.preview}
											alt={fileData.altText || fileData.file.name}
											className="size-full object-contain"
										/>
										{fileData.status !== 'uploading' && (
											<Button
												variant="destructive"
												size="icon"
												className="absolute top-2 right-2 h-6 w-6"
												onClick={() => removeFile(fileData.id)}
											>
												<X className="h-3 w-3" />
											</Button>
										)}
										{fileData.status === 'success' && (
											<div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
												<CheckCircle className="h-12 w-12 text-green-600" />
											</div>
										)}
										{fileData.status === 'error' && (
											<div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
												<AlertCircle className="h-12 w-12 text-red-600" />
											</div>
										)}
									</div>
									<CardContent className="p-4 space-y-3">
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0 flex-1">
												<p className="truncate font-medium text-sm">
													{fileData.file.name}
												</p>
												<p className="text-muted-foreground text-xs">
													{formatFileSize(fileData.file.size)}
													{fileData.width && fileData.height && (
														<>
															{' '}
															• {fileData.width}×{fileData.height}
														</>
													)}
												</p>
											</div>
											<Badge
												variant={
													fileData.status === 'success'
														? 'default'
														: fileData.status === 'error'
															? 'destructive'
															: fileData.status === 'uploading'
																? 'secondary'
																: 'outline'
												}
											>
												{fileData.status === 'success'
													? 'Done'
													: fileData.status === 'error'
														? 'Failed'
														: fileData.status === 'uploading'
															? 'Uploading'
															: 'Pending'}
											</Badge>
										</div>

										{fileData.status === 'error' && fileData.error && (
											<p className="text-destructive text-xs">
												{fileData.error}
											</p>
										)}

										{fileData.status === 'pending' && (
											<div className="space-y-2">
												<div>
													<Label
														htmlFor={`alt-${fileData.id}`}
														className="text-xs"
													>
														Alt Text (optional)
													</Label>
													<Input
														id={`alt-${fileData.id}`}
														value={fileData.altText}
														onChange={(e) =>
															updateFileAltText(fileData.id, e.target.value)
														}
														placeholder="Describe this image..."
														className="h-8 text-sm"
													/>
												</div>
												<div className="flex items-center space-x-2">
													<Switch
														id={`signed-${fileData.id}`}
														checked={fileData.requireSignedURLs}
														onCheckedChange={(checked) =>
															updateFileSignedUrls(
																fileData.id,
																checked === true,
															)
														}
													/>
													<Label
														htmlFor={`signed-${fileData.id}`}
														className="text-xs"
													>
														Signed URL Setting
													</Label>
												</div>
											</div>
										)}
									</CardContent>
								</Card>
							))}
						</div>
					</div>
				)}

				{/* Empty State */}
				{files.length === 0 && (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<FileImage className="text-muted-foreground mb-4 h-12 w-12" />
						<h3 className="text-lg font-medium">No images selected</h3>
						<p className="text-muted-foreground">
							Drag and drop images or click to browse
						</p>
					</div>
				)}
			</section>
		</>
	);
}
