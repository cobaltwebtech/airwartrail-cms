import type React from 'react';
import { convertToGb, formatDate, formatDuration } from '@/lib/video-helpers';

interface VideoInfoProps {
	initialTitle: string;
	duration: number;
	statusText: string;
	views: number;
	storageSize: number;
	dateUploaded?: string;
}

const VideoInfo: React.FC<VideoInfoProps> = ({
	initialTitle,
	duration,
	statusText,
	views,
	storageSize,
	dateUploaded,
}) => {
	return (
		<div className="col-span-full">
			<h3 className="text-2xl font-bold text-center mb-8">{initialTitle}</h3>
			<div className="grid grid-cols-5 gap-x-4">
				<p className="text-muted-foreground text-sm">
					Duration:{' '}
					<span className="text-primary bg-secondary rounded-sm px-2 py-1">
						{formatDuration(duration)}
					</span>
				</p>
				<p className="text-muted-foreground text-sm">
					Views:{' '}
					<span className="text-primary bg-secondary rounded-sm px-2 py-1">
						{views}
					</span>
				</p>
				<p className="text-muted-foreground text-sm">
					Status:{' '}
					<span className="text-primary bg-secondary rounded-sm px-2 py-1">
						{statusText}
					</span>
				</p>
				<p className="text-muted-foreground text-sm">
					Uploaded:{' '}
					<span className="text-primary bg-secondary rounded-sm px-2 py-1">
						{formatDate(dateUploaded)}
					</span>
				</p>
				<p className="text-muted-foreground text-sm">
					Storage Size:{' '}
					<span className="text-primary bg-secondary rounded-sm px-2 py-1">
						{convertToGb(storageSize)}GB
					</span>
				</p>
			</div>
		</div>
	);
};

export default VideoInfo;
