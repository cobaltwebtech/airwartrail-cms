import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <section>
      <h2 className="text-2xl font-semibold mb-8">{initialTitle}</h2>
      <form onSubmit={handleTitleChange}>
        <div>
          <label htmlFor="title">Edit Video Title</label>
          <Input
            type="text"
            id="title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={loading}>Save Title</Button>
        {error && <p className="error">{error}</p>}
      </form>
    </section>
  );
};

export default EditTitle;