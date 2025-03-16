import React from 'react';
import { toast } from "sonner";
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface CopyUrlProps {
  videoId: string;
}

const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;

const CopyUrl: React.FC<CopyUrlProps> = ({ videoId }) => {
  const url = `https://iframe.mediadelivery.net/play/${libraryId}/${videoId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    toast('URL copied to clipboard');
  };

  return (
    <Card className="w-full col-span-2">
      <CardHeader>
        <CardTitle>Video URL</CardTitle>
        <CardDescription>Click the Copy URL button below to copy it to your clipboard. Then paste the URL to the video component on the front end.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-1.5">
          <pre className="text-xs">{url}</pre>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button onClick={handleCopy}>Copy URL</Button>
      </CardFooter>
    </Card>
  );
};

export default CopyUrl;