import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Video } from "@/types";

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
        <DialogHeader className="p-4">
          <DialogTitle>{video.title}</DialogTitle>
          <DialogDescription>
            Status: <span className="capitalize">{video.statusText}</span>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
