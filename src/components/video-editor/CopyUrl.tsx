import React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CopyUrlProps {
  videoId: string;
}

const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;

const CopyUrl: React.FC<CopyUrlProps> = ({ videoId }) => {
  const url = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard", {
  duration: Infinity,
});

  };

  return (
    <Card className="w-full col-span-2">
      <CardHeader>
        <CardTitle>Video URL</CardTitle>
        <CardDescription>
          Click the Copy URL button below to copy it to your clipboard. Then
          paste the URL to the video component on the front end.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          <code className="text-[.675rem] break-all">{url}</code>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button onClick={handleCopy}>Copy URL</Button>
      </CardFooter>
    </Card>
  );
};

export default CopyUrl;
