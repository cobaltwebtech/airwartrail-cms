import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
	ArrowDown,
	ArrowUp,
	Copy,
	Eye,
	Film,
	MoreHorizontal,
	Pencil,
	Play,
	Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { copyVideoUrl, formatDate, formatDuration } from '@/lib/videoData';
import type { Video } from '@/types';
import { VideoDelete } from './VideoDelete';
import { VideoDialog } from './VideoDialog';

interface VideoListProps {
	videos: Video[] | null | undefined;
}

export function VideoList({ videos = [] }: VideoListProps) {
	const queryClient = useQueryClient();
	const [searchTerm, setSearchTerm] = useState('');
	const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);
	const [sortCriteria, setSortCriteria] = useState('date');
	const [sortDirection, setSortDirection] = useState('desc');

	// Delete mutation using tRPC
	const deleteVideoMutation = useMutation(
		trpc.bunny.deleteVideo.mutationOptions({
			onSuccess: () => {
				toast.success('Video deleted successfully');
				// Invalidate the videos query to refetch
				queryClient.invalidateQueries({
					queryKey: [['bunny', 'getAllVideos']],
				});
			},
			onError: (error) => {
				toast.error(`Failed to delete video: ${error.message}`);
			},
		}),
	);

	// Ensure videos is an array before filtering
	const videoArray = Array.isArray(videos) ? videos : [];

	const filteredVideos = videoArray
		.filter((video) =>
			video.title.toLowerCase().includes(searchTerm.toLowerCase()),
		)
		.sort((a, b) => {
			if (sortCriteria === 'title') {
				return sortDirection === 'asc'
					? a.title.localeCompare(b.title)
					: b.title.localeCompare(a.title);
			} else {
				return sortDirection === 'asc'
					? new Date(a.dateUploaded).getTime() -
							new Date(b.dateUploaded).getTime()
					: new Date(b.dateUploaded).getTime() -
							new Date(a.dateUploaded).getTime();
			}
		});

	const toggleSortDirection = () => {
		setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
	};

	const handleCopy = (video: Video) => {
		copyVideoUrl(video.guid || video.id)();
		toast.success('URL copied to clipboard');
	};

	const handleDeleteRequest = (video: Video) => {
		setVideoToDelete(video);
		setIsDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = async () => {
		if (videoToDelete) {
			deleteVideoMutation.mutate({ videoId: videoToDelete.id });
			setIsDeleteDialogOpen(false);
			setVideoToDelete(null);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex justify-between gap-2">
				<Input
					placeholder="Search videos..."
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
					className="max-w-sm"
				/>
				<div className="flex gap-x-4">
					<Select value={sortCriteria} onValueChange={setSortCriteria}>
						<SelectTrigger className="max-w-sm">
							<SelectValue placeholder="Sort by" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="date">Sort by Date</SelectItem>
							<SelectItem value="title">Sort by Title</SelectItem>
						</SelectContent>
					</Select>
					<Button onClick={toggleSortDirection}>
						{sortDirection === 'asc' ? <ArrowUp /> : <ArrowDown />}
					</Button>
				</div>
			</div>

			{selectedVideo && (
				<VideoDialog
					video={selectedVideo}
					open={!!selectedVideo}
					onOpenChange={() => {
						setSelectedVideo(null);
						setIsEditing(false);
					}}
					isEditing={isEditing}
				/>
			)}

			<VideoDelete
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
				onConfirm={handleDeleteConfirm}
			/>

			<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
				{filteredVideos.map((video) => (
					<Card key={video.id} className="gap-2 overflow-hidden pt-0 pb-2">
						<div className="relative">
							<img
								src={
									video.thumbnail || '/placeholder.svg?height=720&width=1280'
								}
								alt={video.title}
								className="aspect-video object-cover"
							/>
							<div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100">
								<Button
									variant="secondary"
									size="icon"
									onClick={() => setSelectedVideo(video)}
								>
									<Play className="h-6 w-6" />
								</Button>
							</div>
							<div className="absolute right-2 bottom-2 rounded bg-black/70 px-1 text-xs text-white">
								{formatDuration(video.duration)}
							</div>
						</div>
						<CardHeader className="p-4">
							<div className="flex items-start justify-between">
								<Link
									to="/edit-video/$videoId"
									params={{ videoId: video.id }}
									className="cursor-pointer"
								>
									<CardTitle className="text-base text-wrap">
										{video.title}
									</CardTitle>
								</Link>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="icon" className="h-8 w-8">
											<MoreHorizontal className="size-4" />
											<span className="sr-only">Open menu</span>
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuLabel>Actions</DropdownMenuLabel>
										<DropdownMenuItem onClick={() => setSelectedVideo(video)}>
											<Eye className="mr-2 size-4" />
											<span>Preview</span>
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => handleCopy(video)}>
											<Copy className="mr-2 size-4" />
											<span>Copy URL</span>
										</DropdownMenuItem>
										<DropdownMenuItem asChild>
											<Link
												to="/edit-video/$videoId"
												params={{ videoId: video.id }}
												className="flex cursor-pointer items-center px-2 py-1.5 text-sm"
											>
												<Pencil className="mr-2 size-4" />
												<span>Edit</span>
											</Link>
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											onClick={() => handleDeleteRequest(video)}
										>
											<Trash2 className="text-destructive-foreground mr-2 size-4" />
											<span className="text-destructive">Delete</span>
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
							<CardDescription>
								Views:{' '}
								<span className="text-primary bg-secondary rounded-sm px-2 py-1 font-bold">
									{video.views}
								</span>
							</CardDescription>
						</CardHeader>
						<CardFooter className="text-muted-foreground p-4 pt-0 text-xs">
							Uploaded on {formatDate(video.dateUploaded)}
						</CardFooter>
					</Card>
				))}
			</div>

			{filteredVideos.length === 0 && (
				<div className="flex flex-col items-center justify-center py-12 text-center">
					<Film className="text-muted-foreground mb-4 h-12 w-12" />
					<h3 className="text-lg font-medium">No videos found</h3>
					<p className="text-muted-foreground">
						{searchTerm
							? 'Try a different search term'
							: 'Upload your first video to get started'}
					</p>
				</div>
			)}
		</div>
	);
}
