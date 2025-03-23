import React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { copyVideoUrl } from "@/lib/videoData";

interface CopyUrlProps {
  videoId: string;
}

const CopyUrl: React.FC<CopyUrlProps> = ({ videoId }) => {
  const handleCopy = () => {
    copyVideoUrl(videoId)();
    toast.success("URL copied to clipboard");
  };

  return (
    <div className="col-span-1 col-end-5 flex items-center justify-end gap-2">
      <Button onClick={handleCopy}>
        <Copy className="size-4" />
        Copy Video URL
      </Button>
    </div>
  );
};

export default CopyUrl;
