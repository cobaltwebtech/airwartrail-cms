import { useState } from "react";
import { Upload, Loader2 } from 'lucide-react';
import { toast } from "sonner";
import * as tus from 'tus-js-client';

import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function VideoUpload() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [upload, setUpload] = useState<tus.Upload | null>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };
  
  const handleCancel = () => {
    if (upload) {
      upload.abort();
    }
    setIsUploading(false);
    setUploadProgress(0);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) return;
    
    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      // 1. Create video in Bunny.net Stream
      console.log("Creating video with title:", title);
      const createResponse = await fetch('/api/videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      });
      
      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(`Failed to create video: ${errorData.error || createResponse.statusText}`);
      }
      
      const video = await createResponse.json();
      console.log("Video created:", video);
      
      // Make sure we have a valid video ID
      const videoId = video.guid || video.id;
      if (!videoId) {
        throw new Error("No valid video ID returned from API");
      }
      
      // 2. Get authentication token and other necessary headers for the upload
      console.log("Getting auth token for resumable upload");
      const authResponse = await fetch(`/api/auth/upload-token?videoId=${videoId}`);
      
      if (!authResponse.ok) {
        throw new Error("Failed to get authentication token for upload");
      }
      
      const { token, signature, expire } = await authResponse.json();
      const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;
      
      console.log("Token received:", token);
      console.log("Video ID:", videoId);
      console.log("Signature:", signature);
      console.log("Expire:", expire);
      
      // 3. Use the TUS client for resumable uploads
      return new Promise<void>((resolve, reject) => {
        const tusUpload = new tus.Upload(file, {
          // This is the correct endpoint for Bunny.net Stream TUS uploads
          endpoint: "https://video.bunnycdn.com/tusupload",
          retryDelays: [0, 3000, 5000, 10000, 20000, 60000, 60000],
          headers: {
            "AuthorizationSignature": signature,
            "AuthorizationExpire": expire.toString(),
            "LibraryId": libraryId.toString(),
            "VideoId": videoId,
          },
          metadata: {
            filetype: file.type,
            title: title,
          },
          onError: function(error) {
            console.error("Failed because: " + error);
            toast.error("Upload failed", {
              description: error.message || "An unexpected error occurred",
            });
            setIsUploading(false);
            setUploadProgress(0);
            reject(error);
          },
          onProgress: function(bytesUploaded, bytesTotal) {
            const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
            console.log(bytesUploaded, bytesTotal, percentage + "%");
            setUploadProgress(percentage);
          },
          onSuccess: function() {
            console.log("Upload successful!");
            toast.success("Video uploaded successfully", {
              description: "Your video is now processing and will be available soon.",
            });
            setTitle("");
            setFile(null);
            setOpen(false);
            setIsUploading(false);
            setUploadProgress(0);
            
            // Refresh the page to show the new video
            setTimeout(() => {
              window.location.reload();
            }, 1500);
            
            resolve();
          },
        });
        
        // Store the upload instance to allow cancellation
        setUpload(tusUpload);
        
        // Check if there are any previous uploads to continue
        tusUpload.findPreviousUploads().then(function(previousUploads) {
          // Found previous uploads so we select the first one
          if (previousUploads.length) {
            tusUpload.resumeFromPreviousUpload(previousUploads[0]);
          }
          
          // Start the upload
          tusUpload.start();
        });
      });
      
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Upload failed", {
        description: (error instanceof Error ? error.message : "An unexpected error occurred"),
      });
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (isUploading && newOpen === false) {
        return;
      }
      setOpen(newOpen);
    }}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Upload Video
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Upload New Video</DialogTitle>
            <DialogDescription>
              Upload a new video to your Bunny.net Stream library.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
                disabled={isUploading}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="file">Video File</Label>
              <Input
                id="file"
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                disabled={isUploading}
                required
              />
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              )}
            </div>
            
            {isUploading && (
              <div className="space-y-2">
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 ease-in-out" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  Uploading: {uploadProgress}%
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            {isUploading ? (
              <Button 
                type="button" 
                variant="destructive" 
                onClick={handleCancel}
              >
                Cancel Upload
              </Button>
            ) : (
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isUploading || !file || !title}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}