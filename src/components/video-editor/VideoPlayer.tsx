import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VideoPlayerProps {
  videoId: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId }) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSignedUrl = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/videos/${videoId}/videoToken`);
        if (!res.ok) throw new Error("Failed to fetch signed URL");
        const data = (await res.json()) as { url: string };
        setSignedUrl(data.url);
      } catch {
        setSignedUrl(null);
      } finally {
        setLoading(false);
      }
    };

    if (videoId) {
      fetchSignedUrl();
    }
  }, [videoId]);

  return (
    <Card className="col-span-4 col-start-5 row-span-2 w-full">
      <CardHeader>
        <CardTitle>Video Preview</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
};

export default VideoPlayer;
