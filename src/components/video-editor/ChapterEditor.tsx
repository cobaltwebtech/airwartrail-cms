import React, { useState } from 'react';
import { formatDuration } from '@/lib/videoData';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Table,
	TableHeader,
	TableBody,
	TableRow,
	TableCell,
	TableHead,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Save, CirclePlus } from 'lucide-react';
import { toast } from 'sonner';
import TimeInput from './TimeInput';

interface Chapter {
	title: string;
	start: string;
	end: string;
}

interface ChapterEditorProps {
	videoId: string;
	initialChapters: { title: string; start: number; end: number }[];
	videoDuration: number;
}

type ChapterField = 'title' | 'start' | 'end';

const parseDuration = (duration: string): number => {
	const parts = duration.split(':').map(Number);
	if (parts.length === 3) {
		return parts[0] * 3600 + parts[1] * 60 + parts[2];
	} else if (parts.length === 2) {
		return parts[0] * 60 + parts[1];
	} else {
		return parts[0];
	}
};

const isValidDuration = (duration: string): boolean => {
	const parts = duration.split(':');
	if (parts.length === 3) {
		const [hours, minutes, seconds] = parts.map(Number);
		return (
			!isNaN(hours) &&
			!isNaN(minutes) &&
			!isNaN(seconds) &&
			hours >= 0 &&
			minutes >= 0 &&
			minutes < 60 &&
			seconds >= 0 &&
			seconds < 60
		);
	} else if (parts.length === 2) {
		const [minutes, seconds] = parts.map(Number);
		return (
			!isNaN(minutes) &&
			!isNaN(seconds) &&
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
		const prevEnd = parseDuration(chapters[i - 1].end);
		const currentStart = parseDuration(chapters[i].start);
		if (currentStart < prevEnd) {
			return false;
		}
	}
	return true;
};

const ChapterEditor: React.FC<ChapterEditorProps> = ({
	videoId,
	initialChapters,
	videoDuration,
}) => {
	const [chapters, setChapters] = useState<Chapter[]>(
		initialChapters.map((chapter) => ({
			...chapter,
			start: formatDuration(chapter.start),
			end: formatDuration(chapter.end),
		})),
	);

	const handleInputChange = (
		index: number,
		field: ChapterField,
		value: string,
	) => {
		const updatedChapters = [...chapters];
		updatedChapters[index][field] = value;
		setChapters(updatedChapters);
	};

	const handleInputBlur = (index: number, field: ChapterField) => {
		const updatedChapters = [...chapters];
		const value = updatedChapters[index][field];
		if (field === 'start' || field === 'end') {
			if (!isValidDuration(value)) {
				toast.error('Invalid time format. Use hh:mm:ss');
				return;
			}
			if (!isWithinVideoDuration(value, videoDuration)) {
				toast.error('Chapter time exceeds the total video duration');
				return;
			}
			if (!isSequential(updatedChapters)) {
				toast.error(
					'Chapter start time must not be less than the end time of the previous chapter',
				);
				return;
			}
			updatedChapters[index][field] = value;
		}
		setChapters(updatedChapters);
	};

	const addChapter = () => {
		setChapters([
			...chapters,
			{ title: '', start: '00:00:00', end: '00:00:00' },
		]);
	};

	const deleteChapter = (index: number) => {
		setChapters(chapters.filter((_, i) => i !== index));
	};

	const saveChapters = async () => {
		const payload = chapters.map((chapter) => ({
			...chapter,
			start: parseDuration(chapter.start),
			end: parseDuration(chapter.end),
		}));
		try {
			const response = await fetch(`/api/videos/${videoId}/chapters`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ chapters: payload }),
			});

			if (response.ok) {
				toast.success('Chapters saved successfully');
			} else {
				toast.error('Failed to save chapters');
			}
		} catch (error) {
			console.error('Error saving chapters:', error);
			toast.error('Failed to save chapters');
		}
	};

	return (
		<Card className="col-span-full w-full justify-between">
			<CardHeader>
				<CardTitle>Edit Chapters</CardTitle>
				<CardDescription>
					Chapters are displayed in the timeline and allow viewers to more
					easily navigate through the video. Specify the start and end time and
					title. Time should be formatted in hh:mm:ss
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Title</TableHead>
							<TableHead>Start Time</TableHead>
							<TableHead>End Time</TableHead>
							<TableHead className="text-right">Delete</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{chapters.map((chapter, index) => (
							<TableRow key={index}>
								<TableCell className="min-w-[200px]">
									<Input
										value={chapter.title}
										onChange={(e) =>
											handleInputChange(index, 'title', e.target.value)
										}
									/>
								</TableCell>
								<TableCell>
									<TimeInput
										value={chapter.start}
										onChange={(value) =>
											handleInputChange(index, 'start', value)
										}
										onBlur={() => handleInputBlur(index, 'start')}
									/>
								</TableCell>
								<TableCell>
									<TimeInput
										value={chapter.end}
										onChange={(value) => handleInputChange(index, 'end', value)}
										onBlur={() => handleInputBlur(index, 'end')}
									/>
								</TableCell>
								<TableCell className="flex justify-end">
									<Button
										onClick={() => deleteChapter(index)}
										variant="destructive"
										className="size-6"
									>
										<X className="size-4" />
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
			<CardFooter className="flex flex-row items-center justify-between">
				<Button onClick={addChapter}>
					<CirclePlus className="size-4" />
					Add Chapter
				</Button>
				<Button onClick={saveChapters}>
					<Save className="size-4" />
					Save Chapters
				</Button>
			</CardFooter>
		</Card>
	);
};

export default ChapterEditor;
