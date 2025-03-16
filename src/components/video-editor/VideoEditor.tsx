import React, { useState } from 'react';
import TitleEditor from '@/components/video-editor/TitleEditor';
import CopyUrl from '@/components/video-editor/CopyUrl';
import ThumbnailUpload from '@/components/video-editor/ThumbnailUpload';
import { VideoPlayer } from '@/components/video-editor/VideoPlayer';

interface VideoEditorProps {
  video: { title: string; };
  videoId: string;
}

const VideoEditor: React.FC<VideoEditorProps> = ({ video, videoId }) => {
  const [title, setTitle] = useState(video.title);

  const handleTitleUpdate = (newTitle: string) => {
    setTitle(newTitle);
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      <TitleEditor videoId={videoId} initialTitle={title} onTitleUpdate={handleTitleUpdate} />
      <ThumbnailUpload videoId={videoId} />
      <VideoPlayer videoId={videoId} />
      <CopyUrl videoId={videoId} />
    </div>
  );
};

export default VideoEditor;