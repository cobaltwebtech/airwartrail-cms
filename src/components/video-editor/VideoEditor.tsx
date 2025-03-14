import React, { useState } from 'react';
import EditTitle from './EditTitle';
import CopyUrl from './CopyUrl';

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
      <h1>{title}</h1>
      <EditTitle videoId={videoId} initialTitle={title} onTitleUpdate={handleTitleUpdate} />
      <CopyUrl videoId={videoId} />
    </>
  );
};

export default VideoEditor;