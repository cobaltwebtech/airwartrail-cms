import type React from "react";
import { formatDuration, formatDate } from "@/lib/videoData";

interface VideoInfoProps {
  initialTitle: string;
  duration: number;
  statusText: string;
  views: number;
  dateUploaded?: string;
}

const VideoInfo: React.FC<VideoInfoProps> = ({
  initialTitle,
  duration,
  statusText,
  views,
  dateUploaded,
}) => {
  return (
    <div className="col-span-full">
      <h3 className="text-lg font-bold">{initialTitle}</h3>
      <div className="grid grid-cols-6 gap-x-4">
        <p className="text-muted-foreground text-sm">
          Duration: {formatDuration(duration)}
        </p>
        <p className="text-muted-foreground text-sm">
          Views: <span className="capitalize">{views}</span>
        </p>
        <p className="text-muted-foreground text-sm">
          Status: <span className="capitalize">{statusText}</span>
        </p>
        <p className="text-muted-foreground text-sm">
          Upload Date: {formatDate(dateUploaded)}
        </p>
      </div>
    </div>
  );
};

export default VideoInfo;
