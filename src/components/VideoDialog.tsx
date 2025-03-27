import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import type { Video } from "@/types";
import { formatDate } from "@/lib/videoData";

interface VideoDialogProps {
  video: Video;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
}

export function VideoDialog({ video, open, onOpenChange }: VideoDialogProps) {
  // Get the actual video URL from Bunny.net using the public environment variable
  const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;
  const videoUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${video.id}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-2 sm:max-w-screen-lg">
        <div className="aspect-video w-full">
          <iframe
            src={videoUrl}
            className="h-full w-full rounded-t-lg"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
        <div className="flex flex-row justify-between">
          <DialogHeader className="p-4">
            <DialogTitle>
              <a href={`/edit-video/${video.id}`}>{video.title}</a>
            </DialogTitle>
            <DialogDescription>
              Uploaded on{" "}
              <span className="capitalize">
                {formatDate(video.dateUploaded)}
              </span>
            </DialogDescription>
            <DialogDescription>
              Views:{" "}
              <span className="text-primary bg-secondary rounded-sm px-2 py-1 font-bold">
                {video.views}
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <a href={`/edit-video/${video.id}`}>
              <Button variant="outline" size="icon">
                <Pencil className="size-4" />
              </Button>
            </a>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
