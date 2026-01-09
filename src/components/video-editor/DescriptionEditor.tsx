import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Save } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
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
	videoId: string;
	libraryId?: string;
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

	// Query the local database for the video description
	const { data: videoData } = useQuery(
		trpc.mux.getVideoFromDatabase.queryOptions({
			muxAssetId: videoId,
			libraryId,
		}),
	);

	// Update description when data is loaded from database
	useEffect(() => {
		if (videoData?.description !== undefined) {
			setDescription(videoData.description || '');
		}
	}, [videoData]);

	const updateVideoMetadataMutation = useMutation(
		trpc.mux.updateVideoMetadata.mutationOptions({
			onSuccess: () => {
				toast.success('Description updated successfully');
				setIsEditing(false);
				setErrors([]);
				// Invalidate queries to refresh data
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getAsset']],
				});
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getVideoFromDatabase']],
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

		// Update via tRPC - saves to local database with line breaks preserved
		updateVideoMetadataMutation.mutate({
			muxAssetId: videoId,
			libraryId,
			description,
		});
	};

	const handleCancel = () => {
		setDescription(videoData?.description || initialDescription);
		setIsEditing(false);
		setErrors([]);
	};

	const characterCount = description.length;
	const isOverLimit = characterCount > 5000;
	const percentUsed = (characterCount / 5000) * 100;

	return (
		<Card className="col-span-4">
			<CardHeader>
				<CardTitle>Edit Description</CardTitle>
				<CardDescription>
					Description of the video which is displayed on the front-end website
					video player. Maximum of 5000 characters.
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
							disabled={updateVideoMetadataMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							onClick={handleSave}
							disabled={
								updateVideoMetadataMutation.isPending ||
								isOverLimit ||
								description === initialDescription
							}
						>
							<Save />
							{updateVideoMetadataMutation.isPending ? 'Saving...' : 'Save'}
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
