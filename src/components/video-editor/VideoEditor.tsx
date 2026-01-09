import type React from 'react';
import { useState } from 'react';
import ChapterEditor from '@/components/video-editor/ChapterEditor';
import PublishStatus from '@/components/video-editor/PublishStatus';
import TitleEditor from '@/components/video-editor/TitleEditor';
import VideoInfo from '@/components/video-editor/VideoInfo';
import VideoPlayer from '@/components/video-editor/VideoPlayer';
import CaptionEditor from './CaptionEditor';
import DescriptionEditor from './DescriptionEditor';
import VideoData from './VideoData';

interface VideoEditorProps {
	videoId: string;
	libraryId?: string;
	video: {
		title: string;
		description?: string;
		duration: number;
		statusText: string;
		views?: number;
		dateUploaded: string;
		isPublished: boolean;
		captions?: { label: string; srclang: string }[];
		resolutionTier?: string;
		aspectRatio?: string;
		videoQuality?: string;
		maxStoredFrameRate?: number;
		maxWidth?: number;
		maxHeight?: number;
		id?: string;
		muxAssetId?: string;
		muxPlaybackId?: string;
		muxEnvironmentId?: string;
		createdAt?: string;
		updatedAt?: string;
		viewCountSyncedAt?: string;
		libraryName?: string;
	} | null;
}

const VideoEditor: React.FC<VideoEditorProps> = ({
	video,
	videoId,
	libraryId,
}) => {
	const [title, setTitle] = useState(video?.title || '');
	const [description, setDescription] = useState(video?.description || '');
	const duration = video?.duration || 0;
	const dateUploaded = video?.dateUploaded || '';
	const views = video?.views || 0;
	const statusText = video?.statusText || '';
	const captions = video?.captions || [];
	const resolutionTier = video?.resolutionTier;
	const aspectRatio = video?.aspectRatio;
	const videoQuality = video?.videoQuality;
	const maxStoredFrameRate = video?.maxStoredFrameRate;
	const maxWidth = video?.maxWidth;
	const maxHeight = video?.maxHeight;
	const internalId = video?.id || '';
	const muxAssetId = video?.muxAssetId || videoId;
	const muxPlaybackId = video?.muxPlaybackId || '';
	const muxEnvironmentId = video?.muxEnvironmentId || '';
	const createdAt = video?.createdAt;
	const updatedAt = video?.updatedAt;
	const viewCountSyncedAt = video?.viewCountSyncedAt;
	const handleTitleUpdate = (newTitle: string) => {
		setTitle(newTitle);
	};

	const handleDescriptionUpdate = (newDescription: string) => {
		setDescription(newDescription);
	};

	return (
		<div className="grid md:grid-cols-8 gap-4">
			<VideoInfo
				duration={duration}
				views={views}
				initialTitle={title}
				dateUploaded={dateUploaded}
				statusText={statusText}
				libraryName={video?.libraryName}
				resolutionTier={resolutionTier}
				aspectRatio={aspectRatio}
				videoQuality={videoQuality}
				maxStoredFrameRate={maxStoredFrameRate}
				maxWidth={maxWidth}
				maxHeight={maxHeight}
			/>
			<PublishStatus
				videoId={videoId}
				libraryId={libraryId}
				initialPublishStatus={video?.isPublished}
			/>
			<VideoPlayer videoId={videoId} libraryId={libraryId} />
			<TitleEditor
				videoId={videoId}
				libraryId={libraryId}
				initialTitle={title}
				onTitleUpdate={handleTitleUpdate}
			/>
			<DescriptionEditor
				videoId={videoId}
				libraryId={libraryId}
				initialDescription={description}
				onDescriptionUpdate={handleDescriptionUpdate}
			/>
			<CaptionEditor
				videoId={videoId}
				libraryId={libraryId}
				initialCaptions={captions}
			/>
			<ChapterEditor
				videoId={videoId}
				libraryId={libraryId}
				videoDuration={duration}
			/>
			<VideoData
				internalId={internalId}
				libraryId={libraryId || 'n/a'}
				muxAssetId={muxAssetId}
				muxPlaybackId={muxPlaybackId}
				muxEnvironmentId={muxEnvironmentId}
				createdAt={createdAt}
				updatedAt={updatedAt}
				viewCountSyncedAt={viewCountSyncedAt}
			/>
		</div>
	);
};

export default VideoEditor;
