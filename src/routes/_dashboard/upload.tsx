import MuxUploader, {
	type MuxUploaderRefAttributes,
} from '@mux/mux-uploader-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CheckCircle, ChevronLeft, Loader2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { DashboardHeader } from '@/components/DashboardHeader';
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_dashboard/upload')({
	loader: async ({ context: { queryClient } }) => {
		// Prefetch libraries for the selector
		await queryClient.ensureQueryData(trpc.mux.listLibraries.queryOptions());
	},
	component: UploadPage,
});

function UploadPage() {
	const queryClient = useQueryClient();

	// Form state
	const [selectedLibraryId, setSelectedLibraryId] = useState<string>('');
	const [title, setTitle] = useState('');
	const [videoQuality, setVideoQuality] = useState<
		'default' | 'basic' | 'plus' | 'premium'
	>('default');
	const [playbackPolicy, setPlaybackPolicy] = useState<
		'default' | 'public' | 'signed'
	>('default');
	const [autoCaptions, setAutoCaptions] = useState(false);

	// Upload state
	const [uploadUrl, setUploadUrl] = useState<string | null>(null);
	const [uploadId, setUploadId] = useState<string | null>(null);
	const [uploadComplete, setUploadComplete] = useState(false);
	const [isSyncing, setIsSyncing] = useState(false);
	const [syncComplete, setSyncComplete] = useState(false);
	const [syncedVideoId, setSyncedVideoId] = useState<string | null>(null);
	const uploaderRef = useRef<MuxUploaderRefAttributes | null>(null);

	// Fetch libraries for selector
	const {
		data: libraries,
		isLoading: librariesLoading,
		error: librariesError,
	} = useQuery(trpc.mux.listLibraries.queryOptions());

	// Set default library when libraries load
	useEffect(() => {
		if (libraries && libraries.length > 0 && !selectedLibraryId) {
			const defaultLibrary = libraries.find((lib) => lib.isDefault);
			setSelectedLibraryId(defaultLibrary?.id ?? libraries[0].id);
		}
	}, [libraries, selectedLibraryId]);

	// Create direct upload mutation
	const createUploadMutation = useMutation(
		trpc.mux.createDirectUpload.mutationOptions({
			onSuccess: (upload) => {
				setUploadUrl(upload.url);
				setUploadId(upload.id);
				toast.success('Upload URL created', {
					description: 'Ready to upload your video',
				});
			},
			onError: (error) => {
				toast.error('Failed to create upload', {
					description: error.message || 'An unexpected error occurred',
				});
			},
		}),
	);

	// Poll for upload status once we have an uploadId and upload is complete
	const { data: uploadStatus } = useQuery(
		trpc.mux.getDirectUpload.queryOptions(
			{ uploadId: uploadId ?? '', libraryId: selectedLibraryId },
			{
				enabled:
					!!uploadId && !!selectedLibraryId && uploadComplete && !syncComplete,
				refetchInterval: (query) => {
					const data = query.state.data;
					// Stop polling once asset is created
					if (data?.status === 'asset_created' && data?.assetId) {
						return false;
					}
					return 2000; // Poll every 2 seconds
				},
			},
		),
	);

	// Sync asset to database mutation
	const syncAssetMutation = useMutation(
		trpc.mux.syncSingleAsset.mutationOptions({
			onSuccess: (result) => {
				setSyncComplete(true);
				setIsSyncing(false);
				setSyncedVideoId(result.videoId);
				toast.success('Video uploaded and synced!', {
					description: `"${title}" is now available in your library`,
				});
				// Invalidate video list to show new video
				queryClient.invalidateQueries({
					queryKey: trpc.mux.listAssets.queryKey({
						libraryId: selectedLibraryId,
					}),
				});
			},
			onError: (error) => {
				setIsSyncing(false);
				toast.error('Failed to sync video', {
					description: error.message,
				});
			},
		}),
	);

	// When upload status shows asset_created, sync to database
	useEffect(() => {
		if (
			uploadStatus?.status === 'asset_created' &&
			uploadStatus?.assetId &&
			!isSyncing &&
			!syncComplete
		) {
			setIsSyncing(true);
			syncAssetMutation.mutate({
				muxAssetId: uploadStatus.assetId,
				libraryId: selectedLibraryId,
			});
		}
	}, [
		uploadStatus,
		isSyncing,
		syncComplete,
		selectedLibraryId,
		syncAssetMutation,
	]);

	// Listen for upload success event from MuxUploader
	useEffect(() => {
		const uploader = uploaderRef.current;
		if (!uploader) return;

		const handleSuccess = () => {
			setUploadComplete(true);
			toast.info('Upload complete, processing video...');
		};

		uploader.addEventListener('success', handleSuccess);
		return () => {
			uploader.removeEventListener('success', handleSuccess);
		};
	}, []);

	const handleCreateUpload = async () => {
		if (!title.trim()) {
			toast.error('Please enter a video title');
			return;
		}
		if (!selectedLibraryId) {
			toast.error('Please select a library');
			return;
		}

		const corsOrigin = window.location.origin;
		createUploadMutation.mutate({
			corsOrigin,
			libraryId: selectedLibraryId,
			title,
			metadata: { title },
			// Only pass videoQuality if not using library default
			...(videoQuality !== 'default' && { videoQuality }),
			// Only pass playbackPolicy if not using library default
			...(playbackPolicy !== 'default' && { playbackPolicy }),
			// Only pass autoCaptions if enabled
			...(autoCaptions && {
				autoCaptions: { enabled: true, languageCode: 'en' },
			}),
		});
	};

	const handleReset = () => {
		setTitle('');
		setVideoQuality('default');
		setPlaybackPolicy('default');
		setAutoCaptions(false);
		setUploadUrl(null);
		setUploadId(null);
		setUploadComplete(false);
		setIsSyncing(false);
		setSyncComplete(false);
		setSyncedVideoId(null);
	};

	const selectedLibrary = libraries?.find(
		(lib) => lib.id === selectedLibraryId,
	);
	const isCreatingUpload = createUploadMutation.isPending;

	return (
		<>
			<DashboardHeader
				heading="Upload Video"
				text="Upload a video to your selected library."
			>
				<Button variant="outline" asChild>
					<Link to="/">
						<ChevronLeft className="mr-2 h-4 w-4" />
						Back to Libraries
					</Link>
				</Button>
			</DashboardHeader>

			<div className="max-w-2xl mx-auto p-4 lg:p-6">
				{librariesError ? (
					<Card>
						<CardContent className="py-8">
							<div className="text-destructive text-center">
								Error loading libraries: {librariesError.message}
							</div>
						</CardContent>
					</Card>
				) : librariesLoading ? (
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-48" />
							<Skeleton className="h-4 w-72 mt-2" />
						</CardHeader>
						<CardContent className="space-y-4">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-48 w-full" />
						</CardContent>
					</Card>
				) : !libraries || libraries.length === 0 ? (
					<Card>
						<CardContent className="py-12 text-center">
							<Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
							<h3 className="text-lg font-semibold">No Libraries Available</h3>
							<p className="text-muted-foreground mt-2">
								Create a library first to upload videos.
							</p>
							<Button className="mt-6" asChild>
								<Link to="/library/new">Create Library</Link>
							</Button>
						</CardContent>
					</Card>
				) : syncComplete ? (
					// Success state
					<Card>
						<CardContent className="py-12">
							<div className="flex flex-col items-center justify-center gap-4 text-center">
								<CheckCircle className="h-16 w-16 text-green-500" />
								<h3 className="text-xl font-semibold">Upload Complete!</h3>
								<p className="text-muted-foreground">
									"{title}" has been uploaded and synced to{' '}
									<strong>{selectedLibrary?.name}</strong>.
								</p>
								<div className="flex gap-3 mt-4">
									<Button variant="outline" onClick={handleReset}>
										Upload Another
									</Button>
									{syncedVideoId && (
										<Button asChild>
											<Link
												to="/library/$libraryId/edit-video/$videoId"
												params={{
													libraryId: selectedLibraryId,
													videoId: syncedVideoId,
												}}
											>
												Edit Video
											</Link>
										</Button>
									)}
									<Button variant="secondary" asChild>
										<Link
											to="/library/$libraryId/videos"
											params={{ libraryId: selectedLibraryId }}
										>
											View Library
										</Link>
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				) : uploadUrl ? (
					// Upload in progress
					<Card>
						<CardHeader>
							<CardTitle>Uploading to {selectedLibrary?.name}</CardTitle>
							<CardDescription>
								{uploadComplete
									? 'Processing and syncing your video...'
									: `Uploading "${title}"`}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<MuxUploader ref={uploaderRef} endpoint={uploadUrl} />
							{uploadComplete && (
								<div className="flex items-center justify-center gap-2 text-muted-foreground">
									<Loader2 className="h-4 w-4 animate-spin" />
									<span>
										{isSyncing
											? 'Syncing to database...'
											: 'Waiting for Mux to process...'}
									</span>
								</div>
							)}
						</CardContent>
					</Card>
				) : (
					// Initial form
					<Card>
						<CardHeader>
							<CardTitle>Video Details</CardTitle>
							<CardDescription>
								Select a library and enter a title for your video.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="space-y-2">
								<Label htmlFor="library">Library</Label>
								<Select
									value={selectedLibraryId}
									onValueChange={setSelectedLibraryId}
									disabled={isCreatingUpload}
									required
								>
									<SelectTrigger id="library">
										<SelectValue placeholder="Select a library" />
									</SelectTrigger>
									<SelectContent>
										{libraries.map((library) => (
											<SelectItem key={library.id} value={library.id}>
												{library.name}
												{library.isDefault && ' (Default)'}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{selectedLibrary && (
									<>
										<p className="text-xs text-muted-foreground">
											Default library settings. Can be overriden below.
										</p>
										<p className="text-xs capitalize">
											{selectedLibrary.defaultPlaybackPolicy} playback •{' '}
											{selectedLibrary.defaultVideoQuality} quality
										</p>
									</>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="title">Video Title</Label>
								<Input
									id="title"
									placeholder="Enter video title"
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									disabled={isCreatingUpload}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="videoQuality">Video Quality</Label>
								<Select
									value={videoQuality}
									onValueChange={(value) =>
										setVideoQuality(
											value as 'default' | 'basic' | 'plus' | 'premium',
										)
									}
									disabled={isCreatingUpload}
								>
									<SelectTrigger id="videoQuality">
										<SelectValue placeholder="Select video quality" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="default">
											Use library default
											{selectedLibrary && (
												<span className="capitalize">
													({selectedLibrary.defaultVideoQuality})
												</span>
											)}
										</SelectItem>
										<SelectItem value="basic">Basic</SelectItem>
										<SelectItem value="plus">Plus</SelectItem>
										<SelectItem value="premium">Premium</SelectItem>
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground">
									{videoQuality === 'default'
										? "Uses the library's default quality setting."
										: videoQuality === 'basic'
											? 'No encoding cost. Reduced bitrate ladder.'
											: videoQuality === 'plus'
												? 'AI-powered per-title encoding for consistent high quality.'
												: 'Premium quality for high-end content like sports or movies.'}
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="playbackPolicy">Playback Policy</Label>
								<Select
									value={playbackPolicy}
									onValueChange={(value) =>
										setPlaybackPolicy(value as 'default' | 'public' | 'signed')
									}
									disabled={isCreatingUpload}
								>
									<SelectTrigger id="playbackPolicy">
										<SelectValue placeholder="Select playback policy" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="default">
											Use library default
											{selectedLibrary && (
												<span className="capitalize">
													({selectedLibrary.defaultPlaybackPolicy})
												</span>
											)}
										</SelectItem>
										<SelectItem value="public">Public</SelectItem>
										<SelectItem value="signed">Signed</SelectItem>
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground">
									{playbackPolicy === 'default'
										? "Uses the library's default playback policy."
										: playbackPolicy === 'public'
											? 'Anyone with the playback URL can view the video.'
											: 'Requires a signed token to view. More secure for private content.'}
								</p>
							</div>

							<div className="flex items-center justify-between rounded-lg border p-4">
								<div className="space-y-0.5">
									<Label htmlFor="autoCaptions">Auto-generate captions</Label>
									<p className="text-xs text-muted-foreground max-w-sm">
										This will generate captions of the language of the audio
										track. Do not use for mixed-language content, if you plan to
										upload your own captions, or translation of languages.
									</p>
								</div>
								<Switch
									id="autoCaptions"
									checked={autoCaptions}
									onCheckedChange={setAutoCaptions}
									disabled={isCreatingUpload}
								/>
							</div>

							<div className="flex justify-end gap-3">
								<Button variant="outline" asChild>
									<Link to="/">Cancel</Link>
								</Button>
								<Button
									onClick={handleCreateUpload}
									disabled={
										!title.trim() || !selectedLibraryId || isCreatingUpload
									}
								>
									{isCreatingUpload && (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									)}
									<Upload className="mr-2 h-4 w-4" />
									Continue to Upload
								</Button>
							</div>
						</CardContent>
					</Card>
				)}
			</div>
		</>
	);
}
