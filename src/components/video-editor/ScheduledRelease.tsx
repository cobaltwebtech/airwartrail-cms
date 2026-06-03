import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarDays, CalendarOff, Save } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { trpc } from '@/lib/trpc';

interface ScheduledReleaseProps {
	videoId: string;
	libraryId: string;
	initialScheduledReleaseDate: string | null | undefined;
}

const ScheduledRelease: React.FC<ScheduledReleaseProps> = ({
	videoId,
	libraryId,
	initialScheduledReleaseDate,
}) => {
	const queryClient = useQueryClient();
	const [scheduledReleaseDate, setScheduledReleaseDate] = useState<Date | null>(
		null,
	);

	// Sync state when initial value loads
	useEffect(() => {
		if (initialScheduledReleaseDate) {
			setScheduledReleaseDate(new Date(initialScheduledReleaseDate));
		} else {
			setScheduledReleaseDate(null);
		}
	}, [initialScheduledReleaseDate]);

	const isDirty = (() => {
		if (!initialScheduledReleaseDate && !scheduledReleaseDate) {
			return false;
		}
		if (!initialScheduledReleaseDate && scheduledReleaseDate) {
			return true;
		}
		if (initialScheduledReleaseDate && !scheduledReleaseDate) {
			return true;
		}
		if (initialScheduledReleaseDate && scheduledReleaseDate) {
			const initial = new Date(initialScheduledReleaseDate).getTime();
			const current = scheduledReleaseDate.getTime();
			return initial !== current;
		}
		return false;
	})();

	const updateVideoMutation = useMutation(
		trpc.mux.updateVideoById.mutationOptions({
			onSuccess: () => {
				toast.success('Scheduled release date updated successfully!', {
					description: scheduledReleaseDate
						? `Scheduled release set to: ${format(scheduledReleaseDate, 'PPP')}`
						: 'Scheduled release date cleared.',
				});
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
				toast.error('Failed to update scheduled release date!', {
					description: errorMessage,
				});
			},
		}),
	);

	const handleSave = () => {
		updateVideoMutation.mutate({
			videoId,
			libraryId,
			scheduledReleaseDate: scheduledReleaseDate
				? scheduledReleaseDate.toISOString()
				: null,
		});
	};

	return (
		<Card className="col-span-2 gap-2">
			<CardHeader>
				<CardTitle>Scheduled Release</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<Popover>
					<PopoverTrigger asChild className="w-full">
						<Button variant="secondary">
							<CalendarDays />
							{scheduledReleaseDate ? (
								format(scheduledReleaseDate, 'PPP')
							) : (
								<span>Pick a date</span>
							)}
						</Button>
					</PopoverTrigger>
					<PopoverContent align="start" className="w-auto p-0">
						<Calendar
							mode="single"
							selected={scheduledReleaseDate || undefined}
							onSelect={(date) => setScheduledReleaseDate(date || null)}
							required={false}
							defaultMonth={scheduledReleaseDate || undefined}
						/>
					</PopoverContent>
				</Popover>

				{scheduledReleaseDate && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => setScheduledReleaseDate(null)}
						disabled={updateVideoMutation.isPending}
					>
						<CalendarOff />
						Clear scheduled date
					</Button>
				)}

				<div className="flex justify-end">
					<Button
						onClick={handleSave}
						disabled={updateVideoMutation.isPending || !isDirty}
					>
						<Save />
						{updateVideoMutation.isPending ? 'Saving...' : 'Save Date'}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
};

export default ScheduledRelease;
