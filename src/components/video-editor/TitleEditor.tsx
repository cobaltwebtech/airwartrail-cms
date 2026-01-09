import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';

interface EditTitleProps {
	videoId: string;
	libraryId?: string;
	initialTitle: string;
	onTitleUpdate: (newTitle: string) => void; // Callback to update the parent state
}

const EditTitle: React.FC<EditTitleProps> = ({
	videoId,
	libraryId,
	initialTitle,
	onTitleUpdate,
}) => {
	const queryClient = useQueryClient();
	const [title, setTitle] = useState(initialTitle);
	const [error, setError] = useState<string | null>(null);

	// Derived state - calculated directly instead of via useEffect
	const isButtonDisabled = title.trim() === '' || title === initialTitle;

	// Update Mux asset with new title
	const updateMuxAssetMutation = useMutation(
		trpc.mux.updateAsset.mutationOptions({
			onSuccess: () => {
				// After Mux is updated, update local database
				updateLocalDatabaseMutation.mutate({
					muxAssetId: videoId,
					libraryId,
					title,
				});
			},
			onError: (err) => {
				const errorMessage =
					err instanceof Error ? err.message : 'Unknown error';
				setError(errorMessage);
				toast.error('Failed to update title in Mux!', {
					description: errorMessage,
				});
			},
		}),
	);

	// Update local database with new title
	const updateLocalDatabaseMutation = useMutation(
		trpc.mux.updateVideoMetadata.mutationOptions({
			onSuccess: () => {
				setError(null);
				toast.success('Title updated successfully!', {
					description: 'The video title has been updated in Mux and database.',
				});
				onTitleUpdate(title);
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getAsset']],
				});
			},
			onError: (err) => {
				const errorMessage =
					err instanceof Error ? err.message : 'Unknown error';
				setError(errorMessage);
				toast.error('Failed to update title in database!', {
					description: errorMessage,
				});
			},
		}),
	);

	const handleTitleChange = async (event: React.FormEvent) => {
		event.preventDefault();

		if (title.trim() === '') {
			setError('Title cannot be empty');
			toast.error('Title cannot be empty!');
			return;
		}

		// First update Mux, then chain to local database update
		updateMuxAssetMutation.mutate({
			assetId: videoId,
			libraryId,
			title,
		});
	};

	return (
		<Card className="col-span-4">
			<CardHeader>
				<CardTitle>Edit Title</CardTitle>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleTitleChange} className="space-y-2">
					<div className="space-y-1">
						<p className="text-sm">Current Title</p>
						<p className="text-accent text-lg font-semibold">
							{initialTitle || 'No title set'}
						</p>
					</div>
					<Input
						type="text"
						id="title"
						name="title"
						placeholder="Enter new video title"
						onChange={(e) => setTitle(e.target.value)}
					/>
					<div className="flex justify-end pt-2">
						<Button
							type="submit"
							disabled={
								updateMuxAssetMutation.isPending ||
								updateLocalDatabaseMutation.isPending ||
								isButtonDisabled
							}
						>
							<Save />
							{updateMuxAssetMutation.isPending ||
							updateLocalDatabaseMutation.isPending
								? 'Saving...'
								: 'Save Title'}
						</Button>
					</div>
					{error && <p className="text-destructive mt-2 text-sm">{error}</p>}
				</form>
			</CardContent>
		</Card>
	);
};

export default EditTitle;
