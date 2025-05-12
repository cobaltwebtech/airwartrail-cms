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
  onMultipleUpload?: (files: File[]) => Promise<void>;
  formatFileSize: (bytes: number) => string;
}

export function FileUpload({
  isOpen,
  onOpenChange,
  onUpload,
  onMultipleUpload,
  formatFileSize,
}: FileUploadProps) {
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleFileUpload = async () => {
    if (uploadFiles.length === 0) return;

    if (uploadFiles.length === 1) {
      await onUpload(uploadFiles[0]);
    } else if (uploadFiles.length > 1 && onMultipleUpload) {
      await onMultipleUpload(uploadFiles);
    } else {
      // Fallback to uploading files one by one if onMultipleUpload not provided
      for (const file of uploadFiles) {
        await onUpload(file);
      }
    }

    setUploadFiles([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Convert FileList to array
      setUploadFiles(Array.from(e.target.files));
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
      setUploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const totalSize = uploadFiles.reduce((sum, file) => sum + file.size, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Select files or folders to upload to your R2 storage
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
              onChange={handleFileChange}
              className={`absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 ${isDragging ? "pointer-events-none" : ""}`}
              // Allow directory upload
              ref={(input) => {
                if (input) {
                  (input as HTMLInputElement).setAttribute(
                    "webkitdirectory",
                    "",
                  );
                  (input as HTMLInputElement).setAttribute("directory", "");
                  (input as HTMLInputElement).setAttribute("multiple", "");
                }
              }}
            />
            <div className="flex flex-col items-center justify-center">
              <FileUpIcon className="text-muted-foreground mb-2 h-10 w-10" />
              <p className="font-medium">
                {isDragging
                  ? "Drop files here"
                  : "Drag files/folders here or click to browse"}
              </p>
            </div>
          </div>

          {uploadFiles.length > 0 && (
            <div className="bg-secondary max-h-48 overflow-auto rounded-md p-2 text-sm">
              <p className="mb-1 font-semibold">
                {uploadFiles.length}{" "}
                {uploadFiles.length === 1 ? "file" : "files"} selected (
                {formatFileSize(totalSize)})
              </p>
              <ul className="space-y-1">
                {uploadFiles.length <= 10 ? (
                  uploadFiles.map((file, index) => (
                    <li key={index} className="truncate text-xs">
                      {file.name} ({formatFileSize(file.size)})
                    </li>
                  ))
                ) : (
                  <>
                    {uploadFiles.slice(0, 5).map((file, index) => (
                      <li key={index} className="truncate text-xs">
                        {file.name} ({formatFileSize(file.size)})
                      </li>
                    ))}
                    <li className="text-xs font-medium">
                      ...and {uploadFiles.length - 5} more files
                    </li>
                  </>
                )}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={handleFileUpload}
            disabled={uploadFiles.length === 0}
          >
            Upload {uploadFiles.length > 0 ? `(${uploadFiles.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
