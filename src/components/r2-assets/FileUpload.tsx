import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileUpIcon } from "lucide-react";

interface FileUploadProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => Promise<void>;
  formatFileSize: (bytes: number) => string;
}

export function FileUpload({
  isOpen,
  onOpenChange,
  onUpload,
  formatFileSize,
}: FileUploadProps) {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleFileUpload = async () => {
    if (uploadFile) {
      await onUpload(uploadFile);
      setUploadFile(null);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setUploadFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
          <DialogDescription>
            Select a file to upload to your R2 storage
          </DialogDescription>
        </DialogHeader>
        <div
          className="relative grid gap-4 py-4"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div
            className={`relative border-2 ${isDragging ? "border-primary border-dashed" : "border-muted"} rounded-md p-6 text-center`}
          >
            <Input
              id="file-upload"
              type="file"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className={`absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 ${isDragging ? "pointer-events-none" : ""}`}
            />
            <div className="flex flex-col items-center justify-center">
              <FileUpIcon className="text-muted-foreground mb-2 h-10 w-10" />
              <p className="font-medium">
                {isDragging
                  ? "Drop file here"
                  : "Drag file here or click to browse"}
              </p>
            </div>
          </div>

          {uploadFile && (
            <div className="bg-secondary rounded-md p-2 text-sm">
              <p className="font-semibold">{uploadFile.name}</p>
              <p className="text-muted-foreground text-xs">
                {formatFileSize(uploadFile.size)}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleFileUpload} disabled={!uploadFile}>
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
