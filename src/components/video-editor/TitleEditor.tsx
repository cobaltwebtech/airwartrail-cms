import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
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

// Zod schema for title validation
const titleSchema = z
	.string()
	.min(1, 'Title cannot be empty')
	.max(100, 'Title must be 100 characters or less')
	.regex(/^[a-zA-Z0-9]+$/, 'Title can only contain letters and numbers');

interface EditTitleProps {
	videoId: string; // Internal database ID
	libraryId: string;
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

	// Update video by internal ID (updates both database and Mux)
	const updateVideoMutation = useMutation(
		trpc.mux.updateVideoById.mutationOptions({
			onSuccess: () => {
				setError(null);
				toast.success('Title updated successfully!', {
					description: 'The video title has been updated.',
				});
				onTitleUpdate(title);
				// Invalidate video queries to refresh data
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getVideoById']],
				});
				queryClient.invalidateQueries({
					queryKey: [['mux', 'listVideosFromDatabase']],
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

		// Validate using Zod schema
		const validationResult = titleSchema.safeParse(title.trim());

		if (!validationResult.success) {
			const errorMessage =
				validationResult.error.issues[0]?.message || 'Invalid title';
			setError(errorMessage);
			toast.error('Invalid title!', {
				description: errorMessage,
			});
			return;
		}

		// Update video using internal ID
		updateVideoMutation.mutate({
			videoId,
			libraryId,
			title: validationResult.data,
		});
	};

	return (
		<Card className="col-span-2 gap-2">
			<CardHeader>
				<CardTitle>Title</CardTitle>
				<CardDescription className="text-accent font-semibold">
					{initialTitle || 'No title set'}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleTitleChange} className="space-y-2">
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
							disabled={updateVideoMutation.isPending || isButtonDisabled}
						>
							<Save />
							{updateVideoMutation.isPending ? 'Saving...' : 'Save Title'}
						</Button>
					</div>
					{error && <p className="text-destructive mt-2 text-sm">{error}</p>}
				</form>
			</CardContent>
		</Card>
	);
};

export default EditTitle;
