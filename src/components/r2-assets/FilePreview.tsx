import { FileIcon, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface R2File {
  name: string;
  size: number;
  uploaded: string;
  etag: string;
  httpEtag: string;
  url: string;
  path: string;
  isDirectory: false;
  contentType?: string;
}

interface FilePreviewProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFile: R2File | null;
  handleCopy: (file: R2File) => void;
  formatFileSize: (bytes: number) => string;
  formatDate: (dateStr: string) => string;
}

export function FilePreview({
  isOpen,
  onOpenChange,
  selectedFile,
  handleCopy,
  formatFileSize,
  formatDate,
}: FilePreviewProps) {
  const r2BucketUrl = import.meta.env.PUBLIC_R2_BUCKET_URL;
  const isImageFile = (file: R2File) => {
    const fileName = file.path || file.name;
    return (
      file.contentType?.startsWith("image/") ||
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName)
    );
  };

  if (!selectedFile) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-screen-xl">
        <DialogHeader>
          <DialogTitle className="truncate">{selectedFile.name}</DialogTitle>
          <DialogDescription>
            {formatFileSize(selectedFile.size)} | Uploaded on{" "}
            {formatDate(selectedFile.uploaded)}
          </DialogDescription>
        </DialogHeader>
        <div className="bg-secondary flex h-96 items-center justify-center overflow-hidden rounded-md">
          {isImageFile(selectedFile) ? (
            <img
              src={`${r2BucketUrl}/${encodeURIComponent(selectedFile.name)}`}
              alt={selectedFile.name}
              className="h-full max-h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileIcon className="h-24 w-24" />
              <p>Preview not available</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => handleCopy(selectedFile)}>
            <Copy className="mr-2 h-4 w-4" />
            Copy URL
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
