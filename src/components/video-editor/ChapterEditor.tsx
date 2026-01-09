import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CirclePlus, Loader2, Save, Trash2 } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { trpc } from '@/lib/trpc';
import TimeInput from './TimeInput';

interface Chapter {
	id?: string;
	title: string;
	startTime: string;
	endTime?: string;
}

interface ChapterEditorProps {
	videoId: string;
	libraryId?: string;
	videoDuration: number;
}

type ChapterField = 'title' | 'startTime' | 'endTime';

const parseDuration = (duration: string): number => {
	if (!duration || duration.trim() === '') return 0;

	const parts = duration.split(':').map(Number);
	let seconds = 0;

	if (parts.length === 3) {
		seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
	} else if (parts.length === 2) {
		seconds = parts[0] * 60 + parts[1];
	} else {
		seconds = parts[0];
	}

	return seconds;
};

const isValidDuration = (duration: string): boolean => {
	if (!duration || duration.trim() === '') return true; // Empty is valid for optional fields

	const parts = duration.split(':');

	if (parts.length === 3) {
		const [hours, minutes, seconds] = parts.map(Number);
		return (
			!Number.isNaN(hours) &&
			!Number.isNaN(minutes) &&
			!Number.isNaN(seconds) &&
			hours >= 0 &&
			minutes >= 0 &&
			minutes < 60 &&
			seconds >= 0 &&
			seconds < 60
		);
	} else if (parts.length === 2) {
		const [minutes, seconds] = parts.map(Number);
		return (
			!Number.isNaN(minutes) &&
			!Number.isNaN(seconds) &&
			minutes >= 0 &&
			minutes < 60 &&
			seconds >= 0 &&
			seconds < 60
		);
	}
	return false;
};

const isWithinVideoDuration = (
	duration: string,
	videoDuration: number,
): boolean => {
	return parseDuration(duration) <= videoDuration;
};

const isSequential = (chapters: Chapter[]): boolean => {
	for (let i = 1; i < chapters.length; i++) {
		const prevChapter = chapters[i - 1];
		const prevEnd =
			prevChapter.endTime && prevChapter.endTime.trim() !== ''
				? parseDuration(prevChapter.endTime)
				: parseDuration(prevChapter.startTime);
		const currentStart = parseDuration(chapters[i].startTime);
		if (currentStart < prevEnd) {
			return false;
		}
	}
	return true;
};

// Helper to format seconds to hh:mm:ss (whole numbers)
const formatToTimeString = (seconds: number): string => {
	const hrs = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);
	return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const ChapterEditor: React.FC<ChapterEditorProps> = ({
	videoId,
	libraryId,
	videoDuration,
}) => {
	const queryClient = useQueryClient();
	const [chapters, setChapters] = useState<Chapter[]>([]);
	const [hasChanges, setHasChanges] = useState(false);

	// Fetch chapters from database
	const { data: savedChapters, isLoading } = useQuery(
		trpc.mux.getChapters.queryOptions(
			{ videoId, libraryId },
			{ enabled: !!videoId },
		),
	);

	// Save chapters mutation
	const saveChaptersMutation = useMutation(
		trpc.mux.saveChapters.mutationOptions({
			onSuccess: () => {
				toast.success('Chapters saved successfully');
				setHasChanges(false);
				queryClient.invalidateQueries({
					queryKey: trpc.mux.getChapters.queryKey({ videoId, libraryId }),
				});
			},
			onError: (error) => {
				toast.error(`Failed to save chapters: ${error.message}`);
			},
		}),
	);

	// Initialize chapters from saved data
	useEffect(() => {
		if (savedChapters) {
			setChapters(
				savedChapters.map((chapter) => ({
					id: chapter.id,
					title: chapter.title,
					startTime: formatToTimeString(chapter.startTime),
					endTime: chapter.endTime ? formatToTimeString(chapter.endTime) : '',
				})),
			);
		}
	}, [savedChapters]);

	const handleInputChange = (
		index: number,
		field: ChapterField,
		value: string,
	) => {
		const updatedChapters = [...chapters];
		updatedChapters[index] = { ...updatedChapters[index], [field]: value };
		setChapters(updatedChapters);
		setHasChanges(true);
	};

	const handleInputBlur = (index: number, field: ChapterField) => {
		const updatedChapters = [...chapters];
		const value = updatedChapters[index][field];

		if (field === 'startTime') {
			if (!value || !isValidDuration(value)) {
				toast.error('Invalid time format. Use hh:mm:ss');
				return;
			}
			if (!isWithinVideoDuration(value, videoDuration)) {
				toast.error('Chapter time exceeds the total video duration');
				return;
			}
		}

		if (field === 'endTime' && value && value.trim() !== '') {
			if (!isValidDuration(value)) {
				toast.error('Invalid time format. Use hh:mm:ss');
				return;
			}
			if (!isWithinVideoDuration(value, videoDuration)) {
				toast.error('Chapter time exceeds the total video duration');
				return;
			}
		}

		setChapters(updatedChapters);
	};

	const addChapter = () => {
		setChapters([
			...chapters,
			{ title: '', startTime: '00:00:00', endTime: '' },
		]);
		setHasChanges(true);
	};

	const deleteChapter = (index: number) => {
		setChapters(chapters.filter((_, i) => i !== index));
		setHasChanges(true);
	};

	const saveChapters = () => {
		// Validate all chapters before saving
		for (let i = 0; i < chapters.length; i++) {
			const chapter = chapters[i];
			if (!chapter.title.trim()) {
				toast.error(`Chapter ${i + 1} must have a title`);
				return;
			}
			if (!chapter.startTime || !isValidDuration(chapter.startTime)) {
				toast.error(`Chapter ${i + 1} must have a valid start time`);
				return;
			}
		}

		// Sort chapters by start time before saving
		const sortedChapters = [...chapters].sort(
			(a, b) => parseDuration(a.startTime) - parseDuration(b.startTime),
		);

		// Validate that sorted chapters don't overlap
		if (!isSequential(sortedChapters)) {
			toast.error(
				'Chapters have overlapping times. Please adjust the start/end times.',
			);
			return;
		}

		// Update local state to show sorted order
		setChapters(sortedChapters);

		const chaptersPayload = sortedChapters.map((chapter, index) => ({
			id: chapter.id,
			title: chapter.title,
			startTime: parseDuration(chapter.startTime),
			endTime:
				chapter.endTime && chapter.endTime.trim() !== ''
					? parseDuration(chapter.endTime)
					: null,
			sortOrder: index,
		}));

		saveChaptersMutation.mutate({
			videoId,
			libraryId,
			chapters: chaptersPayload,
		});
	};

	if (isLoading) {
		return (
			<Card className="col-span-full w-full justify-between">
				<CardHeader>
					<CardTitle>Edit Chapters</CardTitle>
				</CardHeader>
				<CardContent className="flex items-center justify-center py-8">
					<Loader2 className="size-6 animate-spin" />
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="col-span-full w-full justify-between">
			<CardHeader>
				<CardTitle>Edit Chapters</CardTitle>
				<CardDescription>
					Chapters are displayed in the timeline and allow viewers to more
					easily navigate through the video. Title and start time are required.
					End time is optional—chapters will span until the next chapter or end
					of video. Chapters are automatically sorted by start time when saved.
					Time format: hh:mm:ss
				</CardDescription>
			</CardHeader>
			<CardContent>
				{chapters.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
						<p>No chapters yet. Add a chapter to get started.</p>
					</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>
									Title <span className="text-destructive">*</span>
								</TableHead>
								<TableHead>
									Start Time <span className="text-destructive">*</span>
								</TableHead>
								<TableHead>End Time</TableHead>
								<TableHead className="text-right">Delete</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{chapters.map((chapter, index) => (
								<TableRow key={chapter.id || index}>
									<TableCell className="min-w-50">
										<Input
											value={chapter.title}
											placeholder="Chapter title"
											required
											onChange={(e) =>
												handleInputChange(index, 'title', e.target.value)
											}
										/>
									</TableCell>
									<TableCell>
										<TimeInput
											value={chapter.startTime}
											onChange={(value) =>
												handleInputChange(index, 'startTime', value)
											}
											onBlur={() => handleInputBlur(index, 'startTime')}
										/>
									</TableCell>
									<TableCell>
										<TimeInput
											value={chapter.endTime || ''}
											onChange={(value) =>
												handleInputChange(index, 'endTime', value)
											}
											onBlur={() => handleInputBlur(index, 'endTime')}
										/>
									</TableCell>
									<TableCell className="flex justify-end">
										<Button
											onClick={() => deleteChapter(index)}
											variant="destructive"
											size="icon"
											className="size-8"
										>
											<Trash2 className="size-4" />
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
			<CardFooter className="flex flex-row items-center justify-between">
				<Button onClick={addChapter} variant="outline">
					<CirclePlus className="mr-2 size-4" />
					Add Chapter
				</Button>
				<Button
					onClick={saveChapters}
					disabled={saveChaptersMutation.isPending || !hasChanges}
				>
					{saveChaptersMutation.isPending ? (
						<Loader2 className="mr-2 size-4 animate-spin" />
					) : (
						<Save className="mr-2 size-4" />
					)}
					Save Chapters
				</Button>
			</CardFooter>
		</Card>
	);
};

export default ChapterEditor;
