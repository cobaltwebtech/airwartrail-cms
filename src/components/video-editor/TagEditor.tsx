import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
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

const TAG_REGEX = /^[a-zA-Z0-9:@._\- ]+$/;

const normalizeTags = (raw?: string[]) => {
	const seen = new Set<string>();
	return (raw ?? [])
		.map((tag) => tag?.trim())
		.filter((tag): tag is string => Boolean(tag))
		.filter((tag) => {
			if (seen.has(tag)) {
				return false;
			}
			seen.add(tag);
			return true;
		});
};

const areArraysEqual = (a: string[], b: string[]) => {
	if (a.length !== b.length) return false;
	return a.every((value, index) => value === b[index]);
};

interface TagEditorProps {
	videoId: string;
	libraryId: string;
	initialTags?: string[];
	maxTags?: number;
	onTagsUpdate?: (tags: string[]) => void;
}

const TagEditor: React.FC<TagEditorProps> = ({
	videoId,
	libraryId,
	initialTags,
	maxTags = 12,
	onTagsUpdate,
}) => {
	const queryClient = useQueryClient();
	const normalizedInitial = useMemo(
		() => normalizeTags(initialTags),
		[initialTags],
	);
	const [tags, setTags] = useState(normalizedInitial);
	const [savedTags, setSavedTags] = useState(normalizedInitial);
	const [inputValue, setInputValue] = useState('');
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const normalized = normalizeTags(initialTags);
		setTags(normalized);
		setSavedTags(normalized);
	}, [initialTags]);

	const tagSchema = z
		.string()
		.trim()
		.min(1, 'Tag cannot be empty')
		.max(32, 'Tags must be 32 characters or less')
		.regex(
			TAG_REGEX,
			'Tags may only include letters, numbers, spaces, and : @ . _ -',
		);

	const tagsSchema = z
		.array(tagSchema)
		.max(maxTags, `Maximum ${maxTags} tags allowed`);

	const addTag = () => {
		const trimmed = inputValue.trim();
		if (!trimmed) {
			setError('Tag cannot be empty');
			return;
		}

		if (tags.length >= maxTags) {
			setError(`Maximum ${maxTags} tags reached`);
			return;
		}

		if (tags.includes(trimmed)) {
			setError('Tag already added');
			return;
		}

		const validation = tagSchema.safeParse(trimmed);
		if (!validation.success) {
			setError(validation.error.issues[0].message);
			return;
		}

		setTags((prev) => [...prev, validation.data]);
		setInputValue('');
		setError(null);
	};

	const removeTag = (tagToRemove: string) => {
		setTags((prev) => prev.filter((tag) => tag !== tagToRemove));
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			addTag();
		}
	};

	const updateMutation = useMutation(
		trpc.mux.updateVideoTags.mutationOptions({
			onSuccess: (data) => {
				setTags(data.tags);
				setSavedTags(data.tags);
				toast.success('Tags updated successfully');
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getVideoById']],
				});
				queryClient.invalidateQueries({
					queryKey: [['mux', 'listVideosFromDatabase']],
				});
				if (onTagsUpdate) {
					onTagsUpdate(data.tags);
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

	const handleSave = () => {
		const validation = tagsSchema.safeParse(tags);
		if (!validation.success) {
			const message = validation.error.issues[0].message;
			setError(message);
			toast.error(message);
			return;
		}

		updateMutation.mutate({
			videoId,
			libraryId,
			tags: validation.data,
		});
	};

	const hasChanged = !areArraysEqual(tags, savedTags);
	const canAdd = inputValue.trim().length > 0 && tags.length < maxTags;

	return (
		<Card className="col-span-4">
			<CardHeader>
				<CardTitle>Tags</CardTitle>
				<CardDescription>
					Edit tags for the video for searchability and organization in the
					playlists.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-wrap gap-2">
					{tags.length === 0 ? (
						<p className="text-sm text-muted-foreground">No tags yet.</p>
					) : (
						tags.map((tag) => (
							<Badge key={tag} className="flex items-center gap-1 pr-1">
								<span className="max-w-45 truncate">{tag}</span>
								<button
									type="button"
									onClick={() => removeTag(tag)}
									className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
								>
									<X className="size-3" />
								</button>
							</Badge>
						))
					)}
				</div>

				<div className="flex flex-col gap-2 md:flex-row md:items-center">
					<Input
						value={inputValue}
						onChange={(event) => {
							setInputValue(event.target.value);
							setError(null);
						}}
						onKeyDown={handleKeyDown}
						placeholder={
							tags.length === 0
								? 'Add a tag and press Enter'
								: 'Add another tag'
						}
						maxLength={32}
						aria-invalid={Boolean(error)}
					/>
					<Button
						variant="outline"
						type="button"
						onClick={addTag}
						disabled={!canAdd || updateMutation.isPending}
					>
						<Plus />
						Add tag
					</Button>
				</div>

				{error && <p className="text-destructive text-sm">{error}</p>}

				<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
					<p className="text-sm text-muted-foreground">
						{tags.length}/{maxTags} tags
					</p>
					<div className="flex items-center gap-2">
						<Button
							onClick={handleSave}
							disabled={!hasChanged || updateMutation.isPending}
						>
							<Save />
							{updateMutation.isPending ? 'Saving...' : 'Save Tags'}
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

export default TagEditor;
