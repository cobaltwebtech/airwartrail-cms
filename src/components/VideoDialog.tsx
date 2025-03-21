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
  const videoUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${video.id}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-screen-xl p-2">
        <div className="aspect-video w-full">
          <iframe
            src={videoUrl}
            className="w-full h-full rounded-t-lg"
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
