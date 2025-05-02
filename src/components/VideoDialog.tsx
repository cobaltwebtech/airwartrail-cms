import React, { useEffect, useState } from "react";
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

export const VideoDialog: React.FC<VideoDialogProps> = ({
  video,
  open,
  onOpenChange,
}) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSignedUrl = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/videos/${video.id}/videoToken`);
        if (!res.ok) throw new Error("Failed to fetch signed URL");
        const data = (await res.json()) as { url: string };
        setSignedUrl(data.url);
      } catch {
        setSignedUrl(null);
      } finally {
        setLoading(false);
      }
    };

    if (video.id) {
      fetchSignedUrl();
    }
  }, [video.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-2 sm:max-w-screen-lg">
        <div className="aspect-video w-full">
          {loading ? (
            <div>Loading video...</div>
          ) : signedUrl ? (
            <iframe
              src={signedUrl}
              className="h-full w-full"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          ) : (
            <div>Failed to load video.</div>
          )}
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
};
