import type React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatDuration } from '@/lib/video-helpers';

interface VideoInfoProps {
	initialTitle: string;
	duration: number;
	statusText: string;
	views: number;
	libraryName?: string;
	dateUploaded?: string;
	resolutionTier?: string;
	aspectRatio?: string;
	videoQuality?: string;
	maxStoredFrameRate?: number;
	maxWidth?: number;
	maxHeight?: number;
}

const VideoInfo: React.FC<VideoInfoProps> = ({
	initialTitle,
	duration,
	statusText,
	views,
	libraryName,
	dateUploaded,
	resolutionTier,
	aspectRatio,
	videoQuality,
	maxStoredFrameRate,
	maxWidth,
	maxHeight,
}) => {
	return (
		<Card className="col-span-full">
			<CardHeader>
				<CardTitle className="text-2xl font-bold text-center">
					{initialTitle}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-muted-foreground text-sm">
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">Duration</p>
						<Badge variant="secondary">{formatDuration(duration)}</Badge>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">Library</p>
						<Badge variant="secondary">{libraryName || 'N/A'}</Badge>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">Status</p>
						<Badge variant="secondary">{statusText}</Badge>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">Uploaded</p>
						<Badge variant="secondary">{formatDate(dateUploaded)}</Badge>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">Resolution</p>
						<Badge variant="secondary">
							{maxWidth && maxHeight ? `${maxWidth}×${maxHeight}` : 'N/A'}
						</Badge>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">
							Resolution Tier
						</p>
						<Badge variant="secondary">{resolutionTier || 'N/A'}</Badge>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">Aspect Ratio</p>
						<Badge variant="secondary">{aspectRatio || 'N/A'}</Badge>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">Frame Rate</p>
						<Badge variant="secondary">{maxStoredFrameRate || 'N/A'}</Badge>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">
							Video Quality
						</p>
						<Badge variant="secondary" className="capitalize">
							{videoQuality || 'N/A'}
						</Badge>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">Views</p>
						<Badge variant="secondary">{views}</Badge>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

export default VideoInfo;
