import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"

interface ThumbnailUploadProps {
  videoId: string;
}

const ThumbnailUpload: React.FC<ThumbnailUploadProps> = ({ videoId }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast('Please select a file to upload.');
      return;
    }
    
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/videos/${videoId}/thumbnail`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload thumbnail');
      }

      toast('Thumbnail uploaded successfully!');
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
      toast('Error uploading thumbnail');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-[350px]">
    <CardHeader>
      <CardTitle>Upload Thumbnail</CardTitle>
      <CardDescription>Upload a custom thumbnail to the video.</CardDescription>
    </CardHeader>
    <CardContent>
      <form>
        <div className="grid w-full items-center gap-4">
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="thumbnail">Upload</Label>
            <Input id="thumbnail" type="file" accept="image/*" onChange={handleFileChange} />
          </div>
        </div>
      </form>
    </CardContent>
    <CardFooter className="flex justify-between">
    <Button onClick={handleUpload} disabled={loading}>
        {loading ? 'Uploading...' : 'Upload Thumbnail'}
      </Button>
    </CardFooter>
  </Card>
  );
};

export default ThumbnailUpload;