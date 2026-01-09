import type React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/video-helpers';

interface VideoDataProps {
	internalId: string;
	libraryId: string;
	muxAssetId: string;
	muxPlaybackId: string;
	muxEnvironmentId: string;
	createdAt?: string;
	updatedAt?: string;
	viewCountSyncedAt?: string;
}

const VideoData: React.FC<VideoDataProps> = ({
	internalId,
	libraryId,
	muxAssetId,
	muxPlaybackId,
	muxEnvironmentId,
	createdAt,
	updatedAt,
	viewCountSyncedAt,
}) => {
	return (
		<Card className="col-span-full">
			<CardHeader>
				<CardTitle className="text-lg font-semibold">
					Database Information
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 text-muted-foreground text-sm">
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">
							Internal Video ID
						</p>
						<Badge variant="secondary" className="font-mono text-xs">
							{internalId}
						</Badge>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">
							Internal Library ID
						</p>
						<Badge variant="secondary" className="font-mono text-xs">
							{libraryId}
						</Badge>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">Mux Asset ID</p>
						<Badge variant="secondary" className="font-mono text-xs">
							{muxAssetId}
						</Badge>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">
							Mux Playback ID
						</p>
						<Badge variant="secondary" className="font-mono text-xs">
							{muxPlaybackId}
						</Badge>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">
							Mux Environment ID
						</p>
						<Badge variant="secondary" className="font-mono text-xs">
							{muxEnvironmentId}
						</Badge>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">Created At</p>
						<Badge variant="secondary">{formatDateTime(createdAt)}</Badge>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">Updated At</p>
						<Badge variant="secondary">{formatDateTime(updatedAt)}</Badge>
					</div>
					<div>
						<p className="text-xs uppercase tracking-wide mb-1">
							View Count Last Synced
						</p>
						<Badge variant="secondary">
							{formatDateTime(viewCountSyncedAt) || 'n/a'}
						</Badge>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

export default VideoData;
