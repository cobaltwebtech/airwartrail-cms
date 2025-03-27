import type React from "react";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Save } from "lucide-react";

interface EditTitleProps {
  videoId: string;
  initialTitle: string;
  onTitleUpdate: (newTitle: string) => void; // Callback to update the parent state
}

const EditTitle: React.FC<EditTitleProps> = ({
  videoId,
  initialTitle,
  onTitleUpdate,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isButtonDisabled, setIsButtonDisabled] = useState(true);

  // Single useEffect to handle both initial state and changes
  useEffect(() => {
    // Check if the title is empty or unchanged
    setIsButtonDisabled(title.trim() === "" || title === initialTitle);
  }, [title, initialTitle]);

  const handleTitleChange = async (event: React.FormEvent) => {
    event.preventDefault();

    if (title.trim() === "") {
      setError("Title cannot be empty");
      toast.error("Title cannot be empty!");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/videos/${videoId}/titleUpdate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoId, newTitle: title }),
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
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
      toast.error("Failed to update title!", {
        description: (err as Error).message,
      });
    }
  };

  return (
    <Card className="col-span-2 w-full justify-between">
      <CardHeader>
        <CardTitle>Edit Title</CardTitle>
        <CardDescription>
          Enter a new title below and click Save Title.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleTitleChange} className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm">Current Title</p>
            <p className="text-accent text-lg font-semibold">
              {initialTitle || "No title set"}
            </p>
          </div>
          <Input
            type="text"
            id="title"
            name="title"
            placeholder="Enter new video title"
            onChange={(e) => setTitle(e.target.value)}
          />
          <Button
            type="submit"
            disabled={loading || isButtonDisabled}
            className="mt-2"
          >
            <Save className="size-4" />
            {loading ? "Saving..." : "Save Title"}
          </Button>
          {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
};

export default EditTitle;
