import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface VideoPlayerProps {
  videoId: string;
}
const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId }) => {
  // Construct the video URL using the public environment variable
  const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;
  const videoUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`;

  return (
    <Card className="col-span-4 col-start-5 row-span-2 w-full">
      <CardHeader>
        <CardTitle>Video Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="aspect-video w-full">
          <iframe
            src={videoUrl}
            className="h-full w-full"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      </CardContent>
    </Card>
  );
};
export default VideoPlayer;
