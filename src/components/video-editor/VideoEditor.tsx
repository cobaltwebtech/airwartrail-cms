import React, { useState } from 'react';
import EditTitle from '@/components/video-editor/EditTitle';
import CopyUrl from '@/components/video-editor/CopyUrl';
import ThumbnailUpload from '@/components/video-editor/ThumbnailUpload';

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
    <>
      <EditTitle videoId={videoId} initialTitle={title} onTitleUpdate={handleTitleUpdate} />
      <CopyUrl videoId={videoId} />
      <ThumbnailUpload videoId={videoId} />
    </>
  );
};

export default VideoEditor;