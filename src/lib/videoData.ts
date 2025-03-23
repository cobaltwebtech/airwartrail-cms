// This file contains utility functions for formatting video data
import { format } from "date-fns";

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
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
