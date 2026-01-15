import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Tags } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	MultiSelect,
	type MultiSelectOption,
} from '@/components/ui/multi-select';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';

interface TagEditorProps {
	videoId: string;
	libraryId: string;
	/** Initial tag IDs for the video */
	initialTagIds?: string[];
	maxTags?: number;
	onTagsUpdate?: (tagIds: string[]) => void;
}

const areArraysEqual = (a: string[], b: string[]) => {
	if (a.length !== b.length) return false;
	const sortedA = [...a].sort();
	const sortedB = [...b].sort();
	return sortedA.every((value, index) => value === sortedB[index]);
};

const TagEditor: React.FC<TagEditorProps> = ({
	videoId,
	libraryId,
	initialTagIds = [],
	maxTags = 20,
	onTagsUpdate,
}) => {
	const queryClient = useQueryClient();
	const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initialTagIds);
	const [savedTagIds, setSavedTagIds] = useState<string[]>(initialTagIds);
	const [error, setError] = useState<string | null>(null);

	// Fetch all available tags from database
	const {
		data: allTags,
		isLoading: isLoadingTags,
		error: tagsError,
	} = useQuery(trpc.mux.listTags.queryOptions());

	// Sync with external initialTagIds changes
	useEffect(() => {
		setSelectedTagIds(initialTagIds);
		setSavedTagIds(initialTagIds);
	}, [initialTagIds]);

	// Convert tags to MultiSelect options
	const tagOptions: MultiSelectOption[] = useMemo(() => {
		if (!allTags) return [];
		return allTags.map((tag) => ({
			label: tag.name,
			value: tag.id,
		}));
	}, [allTags]);

	const setTagsMutation = useMutation(
		trpc.mux.setVideoTags.mutationOptions({
			onSuccess: (updatedTags) => {
				const tagIds = updatedTags.map((tag) => tag.id);
				setSelectedTagIds(tagIds);
				setSavedTagIds(tagIds);
				toast.success('Tags updated successfully');
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getVideoTags']],
				});
				queryClient.invalidateQueries({
					queryKey: [['mux', 'listVideosFromDatabase']],
				});
				if (onTagsUpdate) {
					onTagsUpdate(tagIds);
				}
				setError(null);
			},
			onError: (err) => {
				const message = err instanceof Error ? err.message : 'Unknown error';
				toast.error('Failed to save tags', { description: message });
				setError(message);
			},
		}),
	);

	const handleSelectionChange = (values: string[]) => {
		if (values.length > maxTags) {
			setError(`Maximum ${maxTags} tags allowed`);
			return;
		}
		setSelectedTagIds(values);
		setError(null);
	};

	const handleSave = () => {
		if (selectedTagIds.length > maxTags) {
			setError(`Maximum ${maxTags} tags allowed`);
			toast.error(`Maximum ${maxTags} tags allowed`);
			return;
		}

		setTagsMutation.mutate({
			videoId,
			libraryId,
			tagIds: selectedTagIds,
		});
	};

	const hasChanged = !areArraysEqual(selectedTagIds, savedTagIds);

	// Get selected tag names for display
	const selectedTagNames = useMemo(() => {
		if (!allTags) return [];
		return selectedTagIds
			.map((id) => allTags.find((tag) => tag.id === id)?.name)
			.filter(Boolean);
	}, [allTags, selectedTagIds]);

	if (tagsError) {
		return (
			<Card className="col-span-3">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Tags className="size-5" />
						Tags
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-destructive text-sm">
						Failed to load tags. Please try again.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="col-span-3">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Tags className="size-5" />
					Tags
				</CardTitle>
				<CardDescription>
					Select tags to organize this video. Tags help with searchability and
					playlist organization.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{isLoadingTags ? (
					<div className="space-y-2">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-4 w-24" />
					</div>
				) : (
					<>
						<MultiSelect
							options={tagOptions}
							onValueChange={handleSelectionChange}
							defaultValue={selectedTagIds}
							placeholder="Select tags..."
							searchable
							maxCount={5}
							emptyMessage="No tags found. Create tags in the Tags management page."
							disabled={setTagsMutation.isPending}
						/>

						{error && <p className="text-destructive text-sm">{error}</p>}

						<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
							<p className="text-sm text-muted-foreground">
								{selectedTagIds.length}/{maxTags} tags selected
								{selectedTagNames.length > 0 && (
									<span className="ml-2 text-xs">
										({selectedTagNames.slice(0, 3).join(', ')}
										{selectedTagNames.length > 3 &&
											` +${selectedTagNames.length - 3} more`}
										)
									</span>
								)}
							</p>
							<div className="flex items-center gap-2">
								<Button
									onClick={handleSave}
									disabled={!hasChanged || setTagsMutation.isPending}
								>
									<Save className="size-4" />
									{setTagsMutation.isPending ? 'Saving...' : 'Save Tags'}
								</Button>
							</div>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
};

export default TagEditor;
