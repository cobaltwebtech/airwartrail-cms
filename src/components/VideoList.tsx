import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2, Play, Eye, Film, Copy } from 'lucide-react';
import { formatDistanceToNow } from "date-fns";
import { Button } from "./ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { VideoDialog } from "./VideoDialog";
import type { Video } from "../lib/bunny-api";
import { CopyEmbed } from "./CopyEmbed";

interface VideoListProps {
  videos: Video[] | null | undefined;
}

export function VideoList({ videos = [] }: VideoListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  
  // Ensure videos is an array before filtering
  const videoArray = Array.isArray(videos) ? videos : [];
  
  const filteredVideos = videoArray.filter(video => 
    video.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  function formatDuration(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
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
          onOpenChange={() => setSelectedVideo(null)} 
        />
      )}
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filteredVideos.map((video) => (
          <Card key={video.id} className="overflow-hidden">
            <div className="relative aspect-video">
              <img
                src={video.thumbnail || "/placeholder.svg?height=720&width=1280"}
                alt={video.title}
                className="object-cover w-full h-full"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/50">
                <Button 
                  variant="secondary" 
                  size="icon"
                  onClick={() => setSelectedVideo(video)}
                >
                  <Play className="h-6 w-6" />
                </Button>
              </div>
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1 rounded">
                {formatDuration(video.duration)}
              </div>
            </div>
            <CardHeader className="p-4">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg truncate">{video.title}</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setSelectedVideo(video)}>
                      <Eye className="mr-2 h-4 w-4" />
                      <span>Preview</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <CopyEmbed 
                        videoId={video.id} 
                        title={video.title}
                        trigger={
                          <div className="flex items-center px-2 py-1.5 text-sm cursor-pointer">
                            <Copy className="mr-2 h-4 w-4" />
                            <span>Copy Embed Code</span>
                          </div>
                        }
                      />
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Pencil className="mr-2 h-4 w-4" />
                      <span>Edit</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <CardDescription>
                Status: <span className="capitalize">{video.status}</span>
              </CardDescription>
            </CardHeader>
            <CardFooter className="p-4 pt-0 text-xs text-muted-foreground">
              Added {formatDistanceToNow(new Date(video.createdAt))} ago
            </CardFooter>
          </Card>
        ))}
      </div>
      
      {filteredVideos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Film className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No videos found</h3>
          <p className="text-muted-foreground">
            {searchTerm ? "Try a different search term" : "Upload your first video to get started"}
          </p>
        </div>
      )}
    </div>
  );
}