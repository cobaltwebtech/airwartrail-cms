import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface EditTitleProps {
  videoId: string;
  initialTitle: string;
  onTitleUpdate: (newTitle: string) => void; // Callback to update the parent state
}

const EditTitle: React.FC<EditTitleProps> = ({ videoId, initialTitle, onTitleUpdate }) => {
  const [title, setTitle] = useState(initialTitle);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTitleChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/videos/update-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ videoId, newTitle: title })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message);
      }

      setLoading(false);
      toast.success("Title updated successfully!", {
        description: "The video title has been updated.",
      });
      onTitleUpdate(title); // Update the parent state with the new title
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      toast.error("Failed to update title!", {
        description: err.message,
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Edit Video Title</CardTitle>
        <CardDescription>Enter a new title below and click Save Title.</CardDescription>
      </CardHeader>
        <CardContent className="space-y-1.5">
          <form onSubmit={handleTitleChange} className="space-y-1.5">
            <Label htmlFor="title">{initialTitle}</Label>
            <Input
              type="text"
              id="title"
              name="title"
              placeholder="Enter new video title"
              onChange={(e) => setTitle(e.target.value)}
            />
          </form>
        </CardContent>
        <CardFooter className="">
          <Button type="submit" disabled={loading}>Save Title</Button>
          {error && <p className="error">{error}</p>}
        </CardFooter>
    </Card>
  );
};

export default EditTitle;