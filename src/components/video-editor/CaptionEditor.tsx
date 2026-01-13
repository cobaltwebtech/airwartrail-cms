import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Trash2, Wand2 } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogOverlay,
	DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { type LanguageCode, SUPPORTED_LANGUAGES } from '@/lib/constants';
import { trpc } from '@/lib/trpc';

interface CaptionEditorProps {
	muxAssetId: string; // Mux Asset ID for direct Mux API calls
	libraryId?: string;
	initialCaptions: { label: string; srclang: string }[];
}

const CaptionEditor: React.FC<CaptionEditorProps> = ({
	muxAssetId,
	libraryId,
	initialCaptions,
}) => {
	const queryClient = useQueryClient();
	const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [trackToDelete, setTrackToDelete] = useState<{
		muxTrackId: string;
		name: string;
	} | null>(null);

	// Fetch tracks from database
	const {
		data: tracks,
		isLoading: tracksLoading,
		refetch: refetchTracks,
	} = useQuery({
		...trpc.mux.getVideoTracks.queryOptions({
			muxAssetId,
			libraryId,
		}),
		// Poll every 5 seconds while there are tracks in "preparing" status
		refetchInterval: (query) => {
			const data = query.state.data;
			const hasPending = data?.some(
				(track) =>
					track.trackCategory === 'text' && track.status === 'preparing',
			);
			return hasPending ? 5000 : false;
		},
	});

	// Filter to only show text tracks (captions/subtitles)
	const captionTracks =
		tracks?.filter((track) => track.trackCategory === 'text') ?? [];

	// Check if any tracks are still preparing (for polling)
	const hasPendingTracks = captionTracks.some(
		(track) => track.status === 'preparing',
	);

	// Generate captions mutation using tRPC
	const generateCaptionsMutation = useMutation(
		trpc.mux.generateCaptions.mutationOptions({
			onSuccess: (data) => {
				toast.success(data.message);
				// Invalidate tracks query to refresh the list
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getVideoTracks']],
				});
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getAsset']],
				});
			},
			onError: (error) => {
				console.error('Error generating captions:', error);
				toast.error(error.message || 'Error generating captions');
			},
		}),
	);

	// Delete caption mutation using tRPC
	const deleteCaptionMutation = useMutation(
		trpc.mux.deleteCaption.mutationOptions({
			onSuccess: () => {
				toast.success('Caption deleted successfully!');
				// Invalidate tracks query to refresh the list
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getVideoTracks']],
				});
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getAsset']],
				});
				setIsDeleteDialogOpen(false);
				setTrackToDelete(null);
			},
			onError: (error) => {
				console.error('Error deleting caption:', error);
				toast.error(error.message || 'Error deleting caption');
			},
		}),
	);

	const handleGenerateCaptions = () => {
		generateCaptionsMutation.mutate({
			assetId: muxAssetId,
			libraryId,
			languageCode: selectedLanguage,
		});
	};

	const handleDeleteRequest = (muxTrackId: string, name: string | null) => {
		setTrackToDelete({ muxTrackId, name: name ?? 'Unknown' });
		setIsDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = () => {
		if (trackToDelete) {
			deleteCaptionMutation.mutate({
				assetId: muxAssetId,
				libraryId,
				trackId: trackToDelete.muxTrackId,
			});
		}
	};

	const handleRefresh = () => {
		refetchTracks();
	};

	// Helper to get status badge variant
	const getStatusBadge = (status: string | null) => {
		switch (status) {
			case 'ready':
				return <Badge variant="accent">Ready</Badge>;
			case 'preparing':
				return (
					<Badge variant="secondary" className="animate-pulse">
						<Loader2 className="mr-1 size-3 animate-spin" />
						Preparing
					</Badge>
				);
			case 'errored':
				return <Badge variant="destructive">Error</Badge>;
			case 'deleted':
				return <Badge variant="outline">Deleted</Badge>;
			default:
				return <Badge variant="outline">Unknown</Badge>;
		}
	};

	// Helper to get source badge
	const getSourceBadge = (textSource: string | null) => {
		if (textSource === 'generated_vod' || textSource === 'generated_live') {
			return (
				<Badge variant="outline" className="ml-2 text-xs">
					Auto-generated
				</Badge>
			);
		}
		if (textSource === 'uploaded') {
			return (
				<Badge variant="outline" className="ml-2 text-xs">
					Uploaded
				</Badge>
			);
		}
		return null;
	};

	// Combine database tracks with initial captions from Mux API
	// Use database tracks if available, otherwise fall back to initial captions
	const displayTracks =
		captionTracks.length > 0
			? captionTracks
			: initialCaptions.map((cap) => ({
					id: cap.srclang,
					muxTrackId: cap.srclang,
					name: cap.label,
					languageCode: cap.srclang,
					status: 'ready' as const,
					textSource: null,
					trackCategory: 'text' as const,
					textCategory: 'subtitles' as const,
					closedCaptions: false,
					isPrimary: false,
					createdAt: new Date(),
					updatedAt: new Date(),
				}));

	return (
		<Card className="col-span-3">
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>Captions</CardTitle>
						<CardDescription>
							Generate auto-captions for your video using AI speech recognition.
						</CardDescription>
					</div>
					{hasPendingTracks && (
						<Button
							variant="ghost"
							size="sm"
							onClick={handleRefresh}
							title="Refresh to check caption status"
						>
							<RefreshCw className="size-4" />
						</Button>
					)}
				</div>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col space-y-4">
					<div className="space-y-2">
						<Label htmlFor="language">Select Language</Label>
						<CardDescription className="text-xs">
							Select the primary language spoken in your video. Captions will be
							auto-generated in this language. Do not use for mixed-language
							content.
						</CardDescription>
						<Select
							value={selectedLanguage}
							onValueChange={(value) =>
								setSelectedLanguage(value as LanguageCode)
							}
						>
							<SelectTrigger className="w-70">
								<SelectValue placeholder="Select a language" />
							</SelectTrigger>
							<SelectContent>
								{SUPPORTED_LANGUAGES.map((lang) => (
									<SelectItem key={lang.code} value={lang.code}>
										{lang.name}
										{lang.status === 'beta' && (
											<span className="text-muted-foreground ml-2 text-xs">
												(Beta)
											</span>
										)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</CardContent>
			<CardFooter className="flex justify-end">
				<Button
					onClick={handleGenerateCaptions}
					disabled={generateCaptionsMutation.isPending}
				>
					<Wand2 className="size-4" />
					{generateCaptionsMutation.isPending
						? 'Generating...'
						: 'Generate Captions'}
				</Button>
			</CardFooter>

			{/* Caption Tracks Table */}
			{tracksLoading ? (
				<CardContent>
					<div className="text-muted-foreground flex items-center gap-2 text-sm">
						<Loader2 className="size-4 animate-spin" />
						Loading caption tracks...
					</div>
				</CardContent>
			) : displayTracks.length > 0 ? (
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Caption</TableHead>
								<TableHead>Language</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{displayTracks.map((track) => (
								<TableRow key={track.muxTrackId}>
									<TableCell>
										<div className="flex items-center">
											{track.name || 'Untitled'}
											{getSourceBadge(track.textSource)}
										</div>
									</TableCell>
									<TableCell>{track.languageCode || 'Unknown'}</TableCell>
									<TableCell>{getStatusBadge(track.status)}</TableCell>
									<TableCell className="text-right">
										<Button
											onClick={() =>
												handleDeleteRequest(track.muxTrackId, track.name)
											}
											variant="destructive"
											size="sm"
											disabled={
												track.status === 'preparing' ||
												track.status === 'deleted'
											}
										>
											<Trash2 className="size-4" />
											<span className="sr-only">Delete</span>
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			) : null}

			{/* Delete Confirmation Dialog */}
			<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<DialogOverlay />
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Confirm Deletion</DialogTitle>
					</DialogHeader>
					<div className="py-4">
						Are you sure you want to delete the caption "
						{trackToDelete?.name || 'this caption'}"? This action cannot be
						undone.
					</div>
					<DialogFooter>
						<Button
							variant="secondary"
							onClick={() => setIsDeleteDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDeleteConfirm}
							disabled={deleteCaptionMutation.isPending}
						>
							{deleteCaptionMutation.isPending ? 'Deleting...' : 'Delete'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
};

export default CaptionEditor;
