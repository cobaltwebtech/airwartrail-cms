import React, { useState } from 'react';
import EditTitle from '@/components/video-editor/EditTitle';

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
    </>
  );
};

export default VideoEditor;