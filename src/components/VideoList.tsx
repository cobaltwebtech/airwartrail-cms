import { useState, useEffect } from "react";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Play,
  Eye,
  Film,
  Copy,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { VideoDialog } from "./VideoDialog";
import { VideoDelete } from "./VideoDelete";
import type { Video } from "@/types";
import { toast } from "sonner";
import { formatDate, formatDuration, copyVideoUrl } from "@/lib/videoData";

interface VideoListProps {
  videos: Video[] | null | undefined;
}

export function VideoList({ videos = [] }: VideoListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);

  useEffect(() => {
    // Check if the deletion flag is set in localStorage
    if (localStorage.getItem("videoDeleted") === "true") {
      toast.success("Video deleted successfully");
      localStorage.removeItem("videoDeleted");
    }
    // Check if the upload flag is set in localStorage
    if (localStorage.getItem("videoUploaded") === "true") {
      toast.success("Video uploaded successfully");
      localStorage.removeItem("videoUploaded");
    }
  }, []);

  // Ensure videos is an array before filtering
  const videoArray = Array.isArray(videos) ? videos : [];

  const filteredVideos = videoArray.filter((video) =>
    video.title.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleCopy = (video: Video) => {
    copyVideoUrl(video.guid || video.id)();
    toast.success("URL copied to clipboard");
  };

  const handleDeleteRequest = (video: Video) => {
    setVideoToDelete(video);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (videoToDelete) {
      try {
        const response = await fetch(`/api/videos/${videoToDelete.id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error("Failed to delete video");
        }
        // Set a flag in localStorage to indicate the video was deleted successfully
        localStorage.setItem("videoDeleted", "true");
        window.location.reload();
      } catch (error) {
        console.error("Error deleting video:", error);
        toast.error("Failed to delete video");
      } finally {
        setIsDeleteDialogOpen(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search videos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filteredVideos.map((video) => (
          <Card key={video.id} className="gap-2 overflow-hidden py-4">
            <div className="relative">
              <img
                src={
                  video.thumbnail || "/placeholder.svg?height=720&width=1280"
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
                <a href={`/edit-video/${video.id}`} className="cursor-pointer">
                  <CardTitle className="text-base text-wrap">
                    {video.title}
                  </CardTitle>
                </a>
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
                      <a
                        href={`/edit-video/${video.id}`}
                        className="flex cursor-pointer items-center px-2 py-1.5 text-sm"
                      >
                        <Pencil className="mr-2 size-4" />
                        <span>Edit</span>
                      </a>
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
                Status: <span className="capitalize">{video.statusText}</span>
              </CardDescription>
            </CardHeader>
            <CardFooter className="text-muted-foreground p-4 pt-0 text-xs">
              Uploaded on {formatDate(video.createdAt)}
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
              ? "Try a different search term"
              : "Upload your first video to get started"}
          </p>
        </div>
      )}
    </div>
  );
}
