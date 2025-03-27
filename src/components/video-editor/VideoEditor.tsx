import React, { useState } from "react";
import TitleEditor from "@/components/video-editor/TitleEditor";
import CopyUrl from "@/components/video-editor/CopyUrl";
import ThumbnailUpload from "@/components/video-editor/ThumbnailUpload";
import VideoPlayer from "@/components/video-editor/VideoPlayer";
import CaptionUpload from "./CaptionUpload";
import VideoInfo from "@/components/video-editor/VideoInfo";
import ChapterEditor from "@/components/video-editor/ChapterEditor";
import MomentsEditor from "./MomentsEditor";
import CollectionEditor from "./CollectionEditor";

interface VideoEditorProps {
  videoId: string;
  video: {
    title: string;
    duration: number;
    statusText: string;
    views: number;
    storageSize: number;
    dateUploaded: string;
    collectionId?: string;
    captions?: { label: string; srclang: string }[];
    chapters?: { title: string; start: number; end: number }[];
    moments?: { label: string; timestamp: number }[];
  } | null;
  collections: { guid: string; name: string }[];
}

const VideoEditor: React.FC<VideoEditorProps> = ({
  video,
  videoId,
  collections,
}) => {
  const [title, setTitle] = useState(video?.title || "");
  const [collectionId, setCollectionId] = useState<string | null>(
    video?.collectionId || null,
  );
  const duration = video?.duration || 0;
  const dateUploaded = video?.dateUploaded || "";
  const views = video?.views || 0;
  const storageSize = video?.storageSize || 0;
  const statusText = video?.statusText || "";
  const captions = video?.captions || [];
  const chapters = video?.chapters || [];
  const moments = video?.moments || [];

  interface HandleUpdateCollectionId {
    (newCollectionId: string | null): void;
  }

  const handleUpdateCollectionId: HandleUpdateCollectionId = (
    newCollectionId,
  ) => {
    setCollectionId(newCollectionId);
  };

  const handleTitleUpdate = (newTitle: string) => {
    setTitle(newTitle);
  };

  return (
    <div className="grid grid-cols-8 gap-4">
      <VideoInfo
        duration={duration}
        views={views}
        storageSize={storageSize}
        initialTitle={title}
        dateUploaded={dateUploaded}
        statusText={statusText}
      />
      <CopyUrl videoId={videoId} />
      <CollectionEditor
        collectionId={collectionId || ""}
        onUpdateCollectionId={handleUpdateCollectionId}
        collections={collections}
        videoId={videoId}
      />
      <VideoPlayer videoId={videoId} />
      <TitleEditor
        videoId={videoId}
        initialTitle={title}
        onTitleUpdate={handleTitleUpdate}
      />
      <ThumbnailUpload videoId={videoId} />
      <MomentsEditor
        videoId={videoId}
        initialMoments={moments}
        videoDuration={duration}
      />
      <CaptionUpload videoId={videoId} initialCaptions={captions} />
      <ChapterEditor
        videoId={videoId}
        initialChapters={chapters}
        videoDuration={duration}
      />
    </div>
  );
};

export default VideoEditor;
