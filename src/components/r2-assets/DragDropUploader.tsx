import { useState, useRef } from "react";
import type { PropsWithChildren } from "react";
import { FileUpIcon } from "lucide-react";
import { toast } from "sonner";

interface DragDropUploaderProps {
  onUpload: (file: File) => Promise<void>;
  onMultipleUpload?: (files: File[]) => Promise<void>;
}

export function DragDropUploader({
  children,
  onUpload,
  onMultipleUpload,
}: PropsWithChildren<DragDropUploaderProps>) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

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

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) {
      return;
    }

    const files = Array.from(e.dataTransfer.files);

    if (files.length === 1) {
      // Single file upload
      toast.info(`Uploading ${files[0].name}...`);
      await onUpload(files[0]);
    } else if (files.length > 1 && onMultipleUpload) {
      // Multiple file upload
      toast.info(`Uploading ${files.length} files...`);
      await onMultipleUpload(files);
    } else if (files.length > 1) {
      // Upload multiple files one by one if onMultipleUpload not provided
      toast.info(`Uploading ${files.length} files...`);

      let completed = 0;
      let failed = 0;

      for (const file of files) {
        try {
          await onUpload(file);
          completed++;
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          failed++;
        }
      }

      if (failed > 0) {
        toast.error(`${failed} uploads failed`);
      }
      if (completed > 0) {
        toast.success(`${completed} files uploaded successfully`);
      }
    }
  };

  return (
    <div
      className="relative h-full w-full"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="bg-primary/10 border-primary absolute inset-0 z-50 flex flex-col items-center justify-center border-2 border-dashed backdrop-blur-sm">
          <FileUpIcon size={48} className="text-primary mb-4" />
          <p className="text-lg font-medium">Drop files here to upload</p>
        </div>
      )}
      {children}
    </div>
  );
}
