import React, { useState } from 'react';

interface EditTitleProps {
  videoId: string;
  initialTitle: string;
}

const EditTitle: React.FC<EditTitleProps> = ({ videoId, initialTitle }) => {
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
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleTitleChange}>
      <div>
        <label htmlFor="title">Title:</label>
        <input
          type="text"
          id="title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <button type="submit" disabled={loading}>Save Title</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
};

export default EditTitle;