import type React from 'react';
import { useState } from 'react';
import ChapterEditor from '@/components/video-editor/ChapterEditor';
import CopyUrl from '@/components/video-editor/CopyUrl';
import TitleEditor from '@/components/video-editor/TitleEditor';
import VideoInfo from '@/components/video-editor/VideoInfo';
import VideoPlayer from '@/components/video-editor/VideoPlayer';
import CaptionUpload from './CaptionUpload';
import CollectionEditor from './CollectionEditor';
import MomentsEditor from './MomentsEditor';

interface VideoEditorProps {
	videoId: string;
	libraryId?: string;
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
	libraryId,
	collections,
}) => {
	const [title, setTitle] = useState(video?.title || '');
	const [collectionId, setCollectionId] = useState<string | null>(
		video?.collectionId || null,
	);
	const duration = video?.duration || 0;
	const dateUploaded = video?.dateUploaded || '';
	const views = video?.views || 0;
	const storageSize = video?.storageSize || 0;
	const statusText = video?.statusText || '';
	const captions = video?.captions || [];
	const chapters = video?.chapters || [];
	const moments = video?.moments || [];

	type HandleUpdateCollectionId = (newCollectionId: string | null) => void;

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
				collectionId={collectionId || ''}
				onUpdateCollectionId={handleUpdateCollectionId}
				collections={collections}
				videoId={videoId}
			/>
			<VideoPlayer videoId={videoId} libraryId={libraryId} />
			<TitleEditor
				videoId={videoId}
				libraryId={libraryId}
				initialTitle={title}
				onTitleUpdate={handleTitleUpdate}
			/>
			<MomentsEditor
				videoId={videoId}
				initialMoments={moments}
				videoDuration={duration}
			/>
			<CaptionUpload
				videoId={videoId}
				libraryId={libraryId}
				initialCaptions={captions}
			/>
			<ChapterEditor
				videoId={videoId}
				initialChapters={chapters}
				videoDuration={duration}
			/>
		</div>
	);
};

export default VideoEditor;
