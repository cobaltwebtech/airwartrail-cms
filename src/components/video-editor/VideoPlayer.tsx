import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface VideoPlayerProps {
  videoId: string;
}

export function VideoPlayer({ videoId }: VideoPlayerProps) {
  // Get the actual video URL from Bunny.net using the public environment variable
  const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;
  const videoUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
  
  return (
    <Card className="w-full col-span-2 row-span-2 col-start-3">
      <CardHeader>
        <CardTitle>Video Preview</CardTitle>
        <CardDescription>Video will play in frame below.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="aspect-video w-full">
          {/* Remove this commented iframe when ready for production
          <iframe
            src={videoUrl}
            className="w-full h-full"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
          */}
        </div>
      </CardContent>
    </Card>
  );
}