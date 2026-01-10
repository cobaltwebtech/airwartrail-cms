import { AlertCircle } from 'lucide-react';
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
	errorType?: string;
	errorMessages?: string; // JSON string array of error messages
	playbackPolicy?: 'public' | 'signed';
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
	errorType,
	errorMessages,
	playbackPolicy,
}) => {
	// Parse error messages from JSON string
	const parsedErrorMessages: string[] = errorMessages
		? (() => {
				try {
					return JSON.parse(errorMessages);
				} catch {
					return [errorMessages];
				}
			})()
		: [];

	const isError = statusText === 'Error';

	return (
		<Card className="col-span-full">
			<CardHeader>
				<CardTitle className="text-2xl font-bold text-center">
					{initialTitle}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Error Alert */}
				{isError && parsedErrorMessages.length > 0 && (
					<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
						<div className="flex items-start gap-3">
							<AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
							<div className="space-y-1">
								<p className="font-medium text-destructive">
									Video Processing Error
									{errorType && (
										<span className="ml-2 text-sm font-normal text-muted-foreground">
											({errorType.replace(/_/g, ' ')})
										</span>
									)}
								</p>
								<ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
									{parsedErrorMessages.map((message) => (
										<li key={message}>{message}</li>
									))}
								</ul>
								<p className="text-sm text-muted-foreground">
									Check the video format, codec, and specifications are
									supported. Please delete this video and upload a new
									reformatted version.
								</p>
							</div>
						</div>
					</div>
				)}

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
						<Badge variant={isError ? 'destructive' : 'secondary'}>
							{statusText}
						</Badge>
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
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">
							Playback Policy
						</p>
						<Badge variant="secondary" className="capitalize">
							{playbackPolicy || 'N/A'}
						</Badge>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

export default VideoInfo;
