import { useQuery } from '@tanstack/react-query';
import { Film } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';
import {
	getDefaultThumbnailDimensions,
	getMuxThumbnailUrl,
} from '@/lib/video-helpers';

export interface VideoThumbnailProps {
	/** The Mux playback ID for the video */
	playbackId: string | null | undefined;
	/** Alt text for the image */
	alt: string;
	/** Additional CSS classes for the image */
	className?: string;
	/** Whether to use 16:9 aspect ratio (640x360) instead of compact (160x90) */
	aspectVideo?: boolean;
	/** Custom width in pixels (overrides aspectVideo) */
	width?: number;
	/** Custom height in pixels (overrides aspectVideo) */
	height?: number;
	/** Playback policy - determines if signed token is required */
	policy?: 'public' | 'signed';
	/** Library ID - required for signed policy to fetch token */
	libraryId?: string;
	/** Time in seconds to capture the thumbnail from */
	time?: number;
	/** Custom fallback icon component */
	fallbackIcon?: React.ReactNode;
}

/**
 * A reusable video thumbnail component for Mux videos.
 * Handles both public and signed playback policies automatically.
 *
 * @example
 * // Public video thumbnail
 * <VideoThumbnail
 *   playbackId="abc123"
 *   alt="Video title"
 *   aspectVideo
 * />
 *
 * @example
 * // Signed video thumbnail (requires libraryId)
 * <VideoThumbnail
 *   playbackId="abc123"
 *   alt="Video title"
 *   policy="signed"
 *   libraryId="lib_123"
 *   aspectVideo
 * />
 */
export function VideoThumbnail({
	playbackId,
	alt,
	className = '',
	aspectVideo = false,
	width,
	height,
	policy = 'public',
	libraryId,
	time,
	fallbackIcon,
}: VideoThumbnailProps) {
	const [isLoaded, setIsLoaded] = useState(false);
	const [hasError, setHasError] = useState(false);

	// Calculate dimensions
	const defaultDimensions = getDefaultThumbnailDimensions(aspectVideo);
	const finalWidth = width ?? defaultDimensions.width;
	const finalHeight = height ?? defaultDimensions.height;

	// Thumbnail params for signed videos - these get embedded in the JWT token
	const thumbnailParams = {
		time: time,
		width: finalWidth,
		height: finalHeight,
		fit_mode: 'smartcrop' as const,
	};

	// Fetch signed token if the video has a signed policy
	// For signed videos, time/width/height/fit_mode are embedded in the JWT token claims
	const { data: signedTokens, isLoading: isLoadingToken } = useQuery(
		trpc.mux.generateSignedTokens.queryOptions(
			{
				playbackId: playbackId ?? '',
				libraryId,
				thumbnailParams: thumbnailParams,
			},
			{
				enabled: policy === 'signed' && !!playbackId && !!libraryId,
				staleTime: 30 * 60 * 1000, // Cache for 30 minutes (tokens expire in 1 hour by default)
			},
		),
	);

	// Generate thumbnail URL based on policy
	// For signed: only token in query string (params are in JWT claims)
	// For public: all params in query string
	const thumbnailUrl =
		policy === 'signed'
			? getMuxThumbnailUrl(playbackId, {}, signedTokens?.thumbnail)
			: getMuxThumbnailUrl(playbackId, {
					width: finalWidth,
					height: finalHeight,
					fitMode: 'smartcrop',
					time,
				});

	// Skeleton classes based on aspect ratio
	const skeletonClass = aspectVideo ? 'aspect-video w-full' : 'h-full w-full';

	const containerClass = aspectVideo ? 'aspect-video' : 'h-full w-full';

	// Show fallback if no playbackId or error occurred
	if (!playbackId || hasError) {
		return (
			<div
				className={`flex items-center justify-center bg-muted ${containerClass}`}
			>
				{fallbackIcon ?? <Film className="size-6 text-muted-foreground" />}
			</div>
		);
	}

	// Show skeleton while loading token for signed videos
	if (policy === 'signed' && (isLoadingToken || !signedTokens?.thumbnail)) {
		return <Skeleton className={skeletonClass} />;
	}

	// Should not happen, but handle null URL case
	if (!thumbnailUrl) {
		return <Skeleton className={skeletonClass} />;
	}

	return (
		<div className={`relative ${containerClass}`}>
			{!isLoaded && (
				<Skeleton className={`absolute inset-0 ${skeletonClass}`} />
			)}
			<img
				src={thumbnailUrl}
				alt={alt}
				className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} h-full w-full object-cover transition-opacity duration-200`}
				onLoad={() => setIsLoaded(true)}
				onError={() => setHasError(true)}
			/>
		</div>
	);
}
