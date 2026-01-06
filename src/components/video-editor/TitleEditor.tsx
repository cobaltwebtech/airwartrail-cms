import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
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

	const updateTitleMutation = useMutation(
		trpc.mux.updateAsset.mutationOptions({
			onSuccess: () => {
				setError(null);
				toast.success('Title updated successfully!', {
					description: 'The video title has been updated.',
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
				toast.error('Failed to update title!', {
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

		updateTitleMutation.mutate({
			assetId: videoId,
			libraryId,
			title,
		});
	};

	return (
		<Card className="col-span-2 w-full justify-between">
			<CardHeader>
				<CardTitle>Edit Title</CardTitle>
				<CardDescription>
					Enter a new title below and click Save Title.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleTitleChange} className="space-y-4">
					<div className="space-y-2">
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
					<Button
						type="submit"
						disabled={updateTitleMutation.isPending || isButtonDisabled}
						className="mt-2"
					>
						<Save className="size-4" />
						{updateTitleMutation.isPending ? 'Saving...' : 'Save Title'}
					</Button>
					{error && <p className="text-destructive mt-2 text-sm">{error}</p>}
				</form>
			</CardContent>
		</Card>
	);
};

export default EditTitle;
