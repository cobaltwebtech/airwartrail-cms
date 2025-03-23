import React, { useState } from "react";
import TitleEditor from "@/components/video-editor/TitleEditor";
import CopyUrl from "@/components/video-editor/CopyUrl";
import ThumbnailUpload from "@/components/video-editor/ThumbnailUpload";
import VideoPlayer from "@/components/video-editor/VideoPlayer";
import CaptionUpload from "./CaptionUpload";
import VideoInfo from "@/components/video-editor/VideoInfo";

interface VideoEditorProps {
  video: {
    title: string;
    duration: number;
    statusText: string;
    createdAt: string;
    collectionId?: string;
  };
  videoId: string;
}

const VideoEditor: React.FC<VideoEditorProps> = ({ video, videoId }) => {
  const [title, setTitle] = useState(video.title);
  const duration = video.duration;
  const dateUploaded = video.createdAt;
  const statusText = video.statusText;
  const collectionId = video.collectionId;

  const handleTitleUpdate = (newTitle: string) => {
    setTitle(newTitle);
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      <VideoInfo
        duration={duration}
        initialTitle={title}
        dateUploaded={dateUploaded}
        statusText={statusText}
        collectionId={collectionId}
      />
      <CopyUrl videoId={videoId} />
      <TitleEditor
        videoId={videoId}
        initialTitle={title}
        onTitleUpdate={handleTitleUpdate}
      />
      <ThumbnailUpload videoId={videoId} />
      <VideoPlayer videoId={videoId} />
      <CaptionUpload videoId={videoId} />
    </div>
  );
};

export default VideoEditor;
