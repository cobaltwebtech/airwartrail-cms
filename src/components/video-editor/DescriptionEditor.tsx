import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Save } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';

interface DescriptionEditorProps {
	videoId: string; // Internal database ID
	libraryId: string;
	initialDescription?: string;
	onDescriptionUpdate?: (description: string) => void;
}

// Zod schema for description validation
const descriptionSchema = z
	.string()
	.max(5000, 'Description must not exceed 5000 characters')
	.optional();

const DescriptionEditor: React.FC<DescriptionEditorProps> = ({
	videoId,
	libraryId,
	initialDescription = '',
	onDescriptionUpdate,
}) => {
	const queryClient = useQueryClient();
	const [description, setDescription] = useState(initialDescription);
	const [isEditing, setIsEditing] = useState(false);
	const [errors, setErrors] = useState<string[]>([]);

	const updateVideoMutation = useMutation(
		trpc.mux.updateVideoById.mutationOptions({
			onSuccess: () => {
				toast.success('Description updated successfully');
				setIsEditing(false);
				setErrors([]);
				// Invalidate queries to refresh data
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getVideoById']],
				});
				queryClient.invalidateQueries({
					queryKey: [['mux', 'listVideosFromDatabase']],
				});
				if (onDescriptionUpdate) {
					onDescriptionUpdate(description);
				}
			},
			onError: (err) => {
				const errorMessage =
					err instanceof Error ? err.message : 'Unknown error';
				toast.error('Failed to update description');
				console.error('Update description error:', errorMessage);
			},
		}),
	);

	const handleSave = () => {
		// Validate with Zod
		const result = descriptionSchema.safeParse(description);

		if (!result.success) {
			const errorMessages = result.error.issues.map((err) => err.message);
			setErrors(errorMessages);
			toast.error(errorMessages[0]);
			return;
		}

		setErrors([]);

		// Update via tRPC - saves to local database using internal ID
		updateVideoMutation.mutate({
			videoId,
			libraryId,
			description,
		});
	};

	const handleCancel = () => {
		setDescription(initialDescription);
		setIsEditing(false);
		setErrors([]);
	};

	const characterCount = description.length;
	const isOverLimit = characterCount > 5000;
	const percentUsed = (characterCount / 5000) * 100;

	return (
		<Card className="col-span-4">
			<CardHeader>
				<CardTitle>Description</CardTitle>
				<CardDescription>
					Description of the video which is displayed on the the airwartrail.com
					website video player. Maximum of 5000 characters.
				</CardDescription>
				{!isEditing && (
					<CardAction>
						<Button
							size="sm"
							onClick={() => setIsEditing(true)}
							className="w-fit"
						>
							<Pencil />
							Edit
						</Button>
					</CardAction>
				)}
			</CardHeader>

			{isEditing ? (
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Add a description for your video..."
							className={isOverLimit ? 'border-destructive' : ''}
							aria-invalid={isOverLimit || errors.length > 0}
							rows={6}
						/>
						<div className="flex items-center justify-between text-sm">
							<div className="flex items-center gap-2">
								<span
									className={
										isOverLimit
											? 'text-destructive font-medium'
											: percentUsed > 90
												? 'text-destructive'
												: 'text-muted-foreground'
									}
								>
									{characterCount} / 5000 characters
								</span>
								{percentUsed > 0 && (
									<span className="text-muted-foreground">
										({percentUsed.toFixed(0)}%)
									</span>
								)}
							</div>
							{errors.length > 0 && (
								<span className="text-destructive">{errors[0]}</span>
							)}
						</div>
					</div>

					<div className="flex justify-end gap-2">
						<Button
							variant="outline"
							onClick={handleCancel}
							disabled={updateVideoMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							onClick={handleSave}
							disabled={
								updateVideoMutation.isPending ||
								isOverLimit ||
								description === initialDescription
							}
						>
							<Save />
							{updateVideoMutation.isPending ? 'Saving...' : 'Save'}
						</Button>
					</div>
				</CardContent>
			) : (
				<CardContent className="text-sm">
					{description ? (
						<p className="whitespace-pre-wrap text-balance bg-secondary p-2 rounded-md">
							{description}
						</p>
					) : (
						<p className="italic text-muted-foreground">
							No description added yet.
						</p>
					)}
				</CardContent>
			)}
		</Card>
	);
};

export default DescriptionEditor;
