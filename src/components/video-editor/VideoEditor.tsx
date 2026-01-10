import type React from 'react';
import { useState } from 'react';
import ChapterEditor from '@/components/video-editor/ChapterEditor';
import PublishStatus from '@/components/video-editor/PublishStatus';
import TitleEditor from '@/components/video-editor/TitleEditor';
import VideoInfo from '@/components/video-editor/VideoInfo';
import VideoPlayer from '@/components/video-editor/VideoPlayer';
import CaptionEditor from './CaptionEditor';
import DescriptionEditor from './DescriptionEditor';
import TagEditor from './TagEditor';
import VideoData from './VideoData';

interface VideoEditorProps {
	videoId: string; // Internal database ID
	libraryId: string;
	video: {
		title: string;
		description?: string;
		tags?: string[];
		duration: number;
		statusText: string;
		views?: number;
		dateUploaded: string;
		isPublished: boolean;
		captions?: { label: string; srclang: string }[];
		resolutionTier?: string | null;
		aspectRatio?: string | null;
		videoQuality?: string | null;
		maxStoredFrameRate?: number | null;
		maxWidth?: number | null;
		maxHeight?: number | null;
		id?: string;
		muxAssetId?: string;
		muxPlaybackId?: string | null;
		muxEnvironmentId?: string | null;
		createdAt?: string;
		updatedAt?: string;
		viewCountSyncedAt?: string | null;
		libraryName?: string;
		errorType?: string | null;
		errorMessages?: string | null;
		playbackPolicy?: 'public' | 'signed';
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
	const resolutionTier = video?.resolutionTier ?? undefined;
	const aspectRatio = video?.aspectRatio ?? undefined;
	const videoQuality = video?.videoQuality ?? undefined;
	const maxStoredFrameRate = video?.maxStoredFrameRate ?? undefined;
	const maxWidth = video?.maxWidth ?? undefined;
	const maxHeight = video?.maxHeight ?? undefined;
	const internalId = video?.id || '';
	const muxAssetId = video?.muxAssetId || videoId;
	const muxPlaybackId = video?.muxPlaybackId || '';
	const muxEnvironmentId = video?.muxEnvironmentId || '';
	const createdAt = video?.createdAt;
	const updatedAt = video?.updatedAt;
	const viewCountSyncedAt = video?.viewCountSyncedAt ?? undefined;
	const errorType = video?.errorType ?? undefined;
	const errorMessages = video?.errorMessages ?? undefined;
	const playbackPolicy = video?.playbackPolicy;
	const tags = video?.tags || [];
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
				errorType={errorType}
				errorMessages={errorMessages}
				playbackPolicy={playbackPolicy}
			/>
			<PublishStatus
				videoId={videoId}
				libraryId={libraryId}
				initialPublishStatus={video?.isPublished}
			/>
			<VideoPlayer
				muxAssetId={muxAssetId}
				libraryId={libraryId}
				internalVideoId={internalId}
			/>
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
			<TagEditor videoId={videoId} libraryId={libraryId} initialTags={tags} />
			<CaptionEditor
				muxAssetId={muxAssetId}
				libraryId={libraryId}
				initialCaptions={captions}
			/>
			<ChapterEditor
				videoId={internalId}
				libraryId={libraryId}
				videoDuration={duration}
			/>
			<VideoData
				internalId={internalId}
				libraryId={libraryId}
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
