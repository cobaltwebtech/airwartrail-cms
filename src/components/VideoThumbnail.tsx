import { useQuery } from '@tanstack/react-query';
import { Film } from 'lucide-react';
import { useEffect, useState } from 'react';
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
	/** Library ID - required for signed policy to fetch token and custom thumbnails */
	libraryId?: string;
	/** Internal video ID - required to fetch custom thumbnail from database */
	videoId?: string;
	/** Time in seconds to capture the thumbnail from (lowest priority) */
	time?: number;
	/** Custom fallback icon component */
	fallbackIcon?: React.ReactNode;
	/** Batch thumbnail data from getThumbnailBatch - avoids individual query */
	batchThumbnailData?: {
		videoId: string;
		customThumbnailUrl: string | null;
		customThumbnailTime: number | null;
		hasCustomThumbnail: boolean;
	};
	/** Batch signed tokens from generateSignedTokensBatch - avoids individual query */
	batchSignedTokens?: {
		playbackId: string;
		playback: string;
		thumbnail: string;
		storyboard: string;
	};
}

/**
 * A reusable video thumbnail component for Mux videos.
 * Handles both public and signed playback policies automatically.
 * Supports custom thumbnail images with automatic priority handling:
 * 1. Custom uploaded thumbnail URL (from database)
 * 2. Custom thumbnail time (from database)
 * 3. Time prop passed to component
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
 *
 * @example
 * // Video thumbnail with custom thumbnail support
 * <VideoThumbnail
 *   playbackId="abc123"
 *   videoId="vid_123"
 *   libraryId="lib_123"
 *   alt="Video title"
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
	videoId,
	time,
	fallbackIcon,
	batchThumbnailData,
	batchSignedTokens,
}: VideoThumbnailProps) {
	const [isLoaded, setIsLoaded] = useState(false);
	const [hasError, setHasError] = useState(false);

	// Calculate dimensions
	const defaultDimensions = getDefaultThumbnailDimensions(aspectVideo);
	const finalWidth = width ?? defaultDimensions.width;
	const finalHeight = height ?? defaultDimensions.height;

	// Fetch custom thumbnail data from database (if videoId and libraryId provided)
	// Skip query if batch data is already provided
	const { data: thumbnailData, isLoading: isLoadingThumbnail } = useQuery(
		trpc.mux.getThumbnail.queryOptions(
			{ videoId: videoId || '', libraryId: libraryId || '' },
			{ enabled: !!videoId && !!libraryId && !batchThumbnailData },
		),
	);

	// Use batch data if provided, otherwise use individual query result
	const effectiveThumbnailData = batchThumbnailData ?? thumbnailData;

	// Determine effective thumbnail time based on priority:
	// 1. customThumbnailTime from database (if exists)
	// 2. time prop passed to component
	const effectiveThumbnailTime =
		effectiveThumbnailData?.customThumbnailTime !== null &&
		effectiveThumbnailData?.customThumbnailTime !== undefined
			? effectiveThumbnailData.customThumbnailTime
			: time;

	// Thumbnail params for signed videos - these get embedded in the JWT token
	const thumbnailParams = {
		time: effectiveThumbnailTime,
		width: finalWidth,
		height: finalHeight,
		fit_mode: 'smartcrop' as const,
	};

	// Priority order for thumbnail:
	// 1. customThumbnailUrl (direct image URL from database)
	// 2. customThumbnailTime or time prop (Mux-generated thumbnail)
	const customThumbnailUrl = effectiveThumbnailData?.customThumbnailUrl;

	// Fetch signed token if the video has a signed policy and we're using Mux thumbnail
	// For signed videos, time/width/height/fit_mode are embedded in the JWT token claims
	// Skip query if batch tokens are already provided
	const { data: signedTokens, isLoading: isLoadingToken } = useQuery(
		trpc.mux.generateSignedTokens.queryOptions(
			{
				playbackId: playbackId ?? '',
				libraryId,
				thumbnailParams: thumbnailParams,
			},
			{
				enabled:
					policy === 'signed' &&
					!!playbackId &&
					!!libraryId &&
					!customThumbnailUrl &&
					!batchSignedTokens, // Only fetch token if not using custom URL and no batch data
				staleTime: 60 * 60 * 1000, // Cache for 1 hour
			},
		),
	);

	// Use batch tokens if provided, otherwise use individual query result
	const effectiveSignedTokens = batchSignedTokens ?? signedTokens;

	// Generate thumbnail URL based on priority
	// Priority 1: Use custom thumbnail URL if it exists (bypass Mux)
	// Priority 2: Use Mux thumbnail with customThumbnailTime or time prop
	const thumbnailUrl = customThumbnailUrl
		? customThumbnailUrl
		: policy === 'signed'
			? getMuxThumbnailUrl(playbackId, {}, effectiveSignedTokens?.thumbnail)
			: getMuxThumbnailUrl(playbackId, {
					width: finalWidth,
					height: finalHeight,
					fitMode: 'smartcrop',
					time: effectiveThumbnailTime,
				});

	// Reset loading state when thumbnail URL changes
	useEffect(() => {
		setIsLoaded(false);
		setHasError(false);
	}, []);

	// Skeleton classes based on aspect ratio
	const skeletonClass = aspectVideo ? 'aspect-video w-full' : 'size-full';

	const containerClass = aspectVideo ? 'aspect-video' : 'size-full';

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

	// Show skeleton while loading custom thumbnail data (only if not using batch data)
	if (!batchThumbnailData && isLoadingThumbnail) {
		return <Skeleton className={skeletonClass} />;
	}

	// Show skeleton while loading token for signed videos (only if not using custom URL or batch data)
	if (
		!customThumbnailUrl &&
		policy === 'signed' &&
		!batchSignedTokens &&
		(isLoadingToken || !effectiveSignedTokens?.thumbnail)
	) {
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
