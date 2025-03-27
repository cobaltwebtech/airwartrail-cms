// This file contains utility functions for formatting video data
import { format } from "date-fns";

export function formatDuration(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function formatDate(dateString: string | undefined) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return format(date, "MMM dd, yyyy");
}

export function copyVideoUrl(videoId: string) {
  const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;
  const url = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(url);
  };
  return handleCopy;
}

export const convertToGb = (sizeInBytes: number): string => {
  return (sizeInBytes / 1024 ** 3).toFixed(2);
};
