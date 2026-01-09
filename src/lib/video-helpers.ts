// This file contains utility functions for formatting video data
import { format } from 'date-fns';

/**
 * Format duration from Mux (total seconds with decimal precision) to HH:MM:SS.S format
 * @param seconds - Duration in seconds (e.g., 23.857167)
 * @returns Formatted duration string (e.g., "00:00:23.9")
 */
export function formatDuration(seconds: number): string {
	if (!seconds || seconds < 0) return '00:00:00.0';

	const hrs = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);
	const tenths = Math.round((seconds % 1) * 10); // Round to 1 decimal place

	// Handle case where rounding tenths results in 10
	const adjustedTenths = tenths === 10 ? 0 : tenths;

	return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${adjustedTenths}`;
}

export function formatDate(dateString: string | undefined) {
	if (!dateString) return '';
	const date = new Date(dateString);
	return format(date, 'MMM dd, yyyy');
}

export function formatDateTime(dateString: string | undefined) {
	if (!dateString) return '';
	const date = new Date(dateString);
	return format(date, 'MMM dd, yyyy HH:mm:ss');
}

export function copyVideoUrl(videoId: string) {
	const libraryId = import.meta.env.VITE_BUNNY_LIBRARY_ID;
	const url = `https://player.mediadelivery.net/embed/${libraryId}/${videoId}`;
	const handleCopy = () => {
		navigator.clipboard.writeText(url);
	};
	return handleCopy;
}

export const convertToGb = (sizeInBytes: number): string => {
	return (sizeInBytes / 1024 ** 3).toFixed(2);
};
