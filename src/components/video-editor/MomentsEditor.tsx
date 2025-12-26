import { CirclePlus, Save, X } from 'lucide-react';
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
import { formatDuration } from '@/lib/video-helpers';
import TimeInput from './TimeInput';

interface Moment {
	title: string;
	time: string;
}

interface MomentsEditorProps {
	videoId: string;
	initialMoments: { label: string; timestamp: number }[];
	videoDuration: number;
}

type MomentField = 'title' | 'time';

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

const MomentsEditor: React.FC<MomentsEditorProps> = ({
	videoId,
	initialMoments,
	videoDuration,
}) => {
	const [moments, setMoments] = useState<Moment[]>(
		initialMoments.map((moment) => ({
			title: moment.label,
			time: formatDuration(moment.timestamp),
		})),
	);

	useEffect(() => {}, [initialMoments, moments]);

	const handleInputChange = (
		index: number,
		field: MomentField,
		value: string,
	) => {
		const updatedMoments = [...moments];
		updatedMoments[index][field] = value;
		setMoments(updatedMoments);
	};

	const handleInputBlur = (index: number, field: MomentField) => {
		const updatedMoments = [...moments];
		const value = updatedMoments[index][field];
		if (field === 'time') {
			if (!isValidDuration(value)) {
				toast.error('Invalid time format. Use hh:mm:ss');
				return;
			}
			if (!isWithinVideoDuration(value, videoDuration)) {
				toast.error('Moment time exceeds the total video duration');
				return;
			}
			updatedMoments[index][field] = value;
		}
		setMoments(updatedMoments);
	};

	const addMoment = () => {
		setMoments([...moments, { title: '', time: '00:00:00' }]);
	};

	const deleteMoment = (index: number) => {
		setMoments(moments.filter((_, i) => i !== index));
	};

	const saveMoments = async () => {
		const payload = moments.map((moment) => ({
			label: moment.title,
			timestamp: parseDuration(moment.time),
		}));
		try {
			const response = await fetch(`/api/videos/${videoId}/moments`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ moments: payload }),
			});

			if (response.ok) {
				toast.success('Moments saved successfully');
			} else {
				toast.error('Failed to save moments');
			}
		} catch (error) {
			console.error('Error saving moments:', error);
			toast.error('Failed to save moments');
		}
	};

	return (
		<Card className="col-span-4 w-full justify-between">
			<CardHeader>
				<CardTitle>Edit Moments</CardTitle>
				<CardDescription>
					Moments are specific points in the video that you want to highlight.
					Specify the time and title. Time should be formatted in hh:mm:ss
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Title</TableHead>
							<TableHead>Time</TableHead>
							<TableHead className="text-right">Delete</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{moments.map((moment, index) => (
							<TableRow key={index}>
								<TableCell className="min-w-[120px]">
									<Input
										value={moment.title}
										onChange={(e) =>
											handleInputChange(index, 'title', e.target.value)
										}
									/>
								</TableCell>
								<TableCell>
									<TimeInput
										value={moment.time}
										onChange={(value) =>
											handleInputChange(index, 'time', value)
										}
										onBlur={() => handleInputBlur(index, 'time')}
									/>
								</TableCell>
								<TableCell className="flex justify-end">
									<Button
										onClick={() => deleteMoment(index)}
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
				<Button onClick={addMoment}>
					<CirclePlus className="size-4" />
					Add Moment
				</Button>
				<Button onClick={saveMoments}>
					<Save className="size-4" />
					Save Moments
				</Button>
			</CardFooter>
		</Card>
	);
};

export default MomentsEditor;
