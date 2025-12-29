import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import * as tus from 'tus-js-client';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';

export function VideoUpload() {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState('');
	const [file, setFile] = useState<File | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [upload, setUpload] = useState<tus.Upload | null>(null);

	// Create video mutation using tRPC
	const createVideoMutation = useMutation(
		trpc.bunny.createVideo.mutationOptions(),
	);

	// Get TUS upload signature mutation using tRPC
	const getTusSignatureMutation = useMutation(
		trpc.bunny.getTusUploadSignature.mutationOptions(),
	);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files?.[0]) {
			setFile(e.target.files[0]);
		}
	};

	const handleCancel = () => {
		if (upload) {
			upload.abort();
		}
		setIsUploading(false);
		setUploadProgress(0);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!file || !title) return;

		try {
			setIsUploading(true);
			setUploadProgress(0);

			// 1. Create video in Bunny.net Stream using tRPC
			const video = await createVideoMutation.mutateAsync({ title });

			const videoId = video.videoId;
			if (!videoId) {
				throw new Error('No valid video ID returned from API');
			}

			// 2. Get authorization signature for TUS upload using tRPC
			const { signature, expirationTime, libraryId } =
				await getTusSignatureMutation.mutateAsync({ videoId });

			// 3. Use the TUS client for resumable uploads
			return new Promise<void>((resolve, reject) => {
				const tusUpload = new tus.Upload(file, {
					endpoint: 'https://video.bunnycdn.com/tusupload',
					retryDelays: [0, 3000, 5000, 10000, 20000, 60000, 60000],
					headers: {
						AuthorizationSignature: signature,
						AuthorizationExpire: expirationTime.toString(),
						LibraryId: libraryId.toString(),
						VideoId: videoId,
					},
					metadata: {
						filetype: file.type,
						title: title,
					},
					onError: (error) => {
						toast.error('Upload failed', {
							description: error.message || 'An unexpected error occurred',
						});
						setIsUploading(false);
						setUploadProgress(0);
						reject(error);
					},
					onProgress: (bytesUploaded, bytesTotal) => {
						const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
						setUploadProgress(percentage);
					},
					onSuccess: () => {
						setTitle('');
						setFile(null);
						setOpen(false);
						setIsUploading(false);
						setUploadProgress(0);

						toast.success('Video uploaded successfully', {
							description:
								'Your video is now processing and will be available soon.',
						});
						// Invalidate the videos query to refetch
						queryClient.invalidateQueries({
							queryKey: [['bunny', 'getAllVideos']],
						});
						resolve();
					},
				});

				setUpload(tusUpload);

				tusUpload.findPreviousUploads().then((previousUploads) => {
					if (previousUploads.length) {
						tusUpload.resumeFromPreviousUpload(previousUploads[0]);
					}

					tusUpload.start();
				});
			});
		} catch (error) {
			toast.error('Upload failed', {
				description:
					error instanceof Error
						? error.message
						: 'An unexpected error occurred',
			});
			setIsUploading(false);
			setUploadProgress(0);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(newOpen) => {
				if (isUploading && newOpen === false) {
					return;
				}
				setOpen(newOpen);
			}}
		>
			<DialogTrigger asChild>
				<Button>
					<Upload className="mr-2 h-4 w-4" />
					Upload Video
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-106.25">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Upload New Video</DialogTitle>
						<DialogDescription>
							Upload a new video to streaming library.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="title">Title</Label>
							<Input
								id="title"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Enter video title"
								disabled={isUploading}
								required
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="file">Video File</Label>
							<Input
								id="file"
								className="file:bg-primary file:text-primary-foreground border-0 bg-transparent px-0 shadow-none file:rounded-sm file:px-4"
								type="file"
								accept="video/*"
								onChange={handleFileChange}
								disabled={isUploading}
								required
							/>
							{file && (
								<p className="text-muted-foreground text-sm">
									Selected: {file.name} (
									{(file.size / (1024 * 1024)).toFixed(2)} MB)
								</p>
							)}
						</div>

						{isUploading && (
							<div className="space-y-2">
								<div className="bg-secondary h-2 w-full overflow-hidden rounded-full">
									<div
										className="bg-primary h-full transition-all duration-300 ease-in-out"
										style={{ width: `${uploadProgress}%` }}
									/>
								</div>
								<p className="text-muted-foreground text-center text-sm">
									Uploading: {uploadProgress}%
								</p>
								<p className="text-foreground text-center text-sm">
									Do not close this window or refresh the page until the upload
									is complete.
								</p>
							</div>
						)}
					</div>
					<DialogFooter>
						{isUploading ? (
							<Button
								type="button"
								variant="destructive"
								onClick={handleCancel}
							>
								Cancel Upload
							</Button>
						) : (
							<Button
								type="button"
								variant="outline"
								onClick={() => setOpen(false)}
							>
								Cancel
							</Button>
						)}
						<Button type="submit" disabled={isUploading || !file || !title}>
							{isUploading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Uploading...
								</>
							) : (
								'Upload'
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
