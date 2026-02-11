import type React from 'react';
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
	totalWatchTime?: number;
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
	totalWatchTime,
}) => {
	return (
		<Card className="col-span-full">
			<CardHeader>
				<CardTitle>Internal Video Data</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid lg:grid-cols-2 gap-4 text-muted-foreground text-sm">
					<div className="space-y-1 text-xs">
						<p className="uppercase tracking-wide">Internal Video ID</p>
						<pre className="bg-secondary text-secondary-foreground px-2 py-1 rounded font-mono text-wrap w-fit">
							{internalId}
						</pre>
					</div>
					<div className="space-y-1 text-xs">
						<p className="uppercase tracking-wide">Internal Library ID</p>
						<pre className="bg-secondary text-secondary-foreground px-2 py-1 rounded font-mono text-wrap w-fit">
							{libraryId}
						</pre>
					</div>
					<div className="space-y-1 text-xs">
						<p className="uppercase tracking-wide">Mux Asset ID</p>
						<pre className="bg-secondary text-secondary-foreground px-2 py-1 rounded font-mono text-wrap w-fit">
							{muxAssetId}
						</pre>
					</div>
					<div className="space-y-1 text-xs">
						<p className="uppercase tracking-wide">Mux Playback ID</p>
						<pre className="bg-secondary text-secondary-foreground px-2 py-1 rounded font-mono text-wrap w-fit">
							{muxPlaybackId}
						</pre>
					</div>
					<div className="space-y-1 text-xs">
						<p className="uppercase tracking-wide">Mux Environment ID</p>
						<pre className="bg-secondary text-secondary-foreground px-2 py-1 rounded font-mono text-wrap w-fit">
							{muxEnvironmentId}
						</pre>
					</div>
					<div className="space-y-1 text-xs">
						<p className="uppercase tracking-wide">Total Watch Time</p>
						<pre className="bg-secondary text-secondary-foreground px-2 py-1 rounded font-mono text-wrap w-fit">
							{(totalWatchTime ?? 0) / 1000}s
						</pre>
					</div>
					<div className="space-y-1 text-xs">
						<p className="uppercase tracking-wide">Created At</p>
						<pre className="bg-secondary text-secondary-foreground px-2 py-1 rounded font-mono text-wrap w-fit">
							{formatDateTime(createdAt)}
						</pre>
					</div>
					<div className="space-y-1 text-xs">
						<p className="uppercase tracking-wide">Updated At</p>
						<pre className="bg-secondary text-secondary-foreground px-2 py-1 rounded font-mono text-wrap w-fit">
							{formatDateTime(updatedAt)}
						</pre>
					</div>
					<div className="space-y-1 text-xs">
						<p className="uppercase tracking-wide">View Count Last Synced</p>
						<pre className="bg-secondary text-secondary-foreground px-2 py-1 rounded font-mono text-wrap w-fit">
							{formatDateTime(viewCountSyncedAt) || 'n/a'}
						</pre>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

export default VideoData;
