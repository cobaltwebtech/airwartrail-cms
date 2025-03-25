import type React from "react";
import { formatDuration, formatDate } from "@/lib/videoData";

interface VideoInfoProps {
  initialTitle: string;
  duration: number;
  statusText: string;
  dateUploaded?: string;
  collectionId?: string;
}

const VideoInfo: React.FC<VideoInfoProps> = ({
  initialTitle,
  duration,
  statusText,
  dateUploaded,
  collectionId,
}) => {
  return (
    <div className="col-span-3">
      <h3 className="text-lg font-bold">{initialTitle}</h3>
      <div className="grid grid-cols-2 gap-x-4">
        <p className="text-muted-foreground text-sm">
          Duration: {formatDuration(duration)}
        </p>
        <p className="text-muted-foreground text-sm">
          Status: <span className="capitalize">{statusText}</span>
        </p>
        <p className="text-muted-foreground text-sm">
          Upload Date: {formatDate(dateUploaded)}
        </p>
        <p className="text-muted-foreground text-sm">
          Collection: {collectionId}
        </p>
      </div>
    </div>
  );
};

export default VideoInfo;
