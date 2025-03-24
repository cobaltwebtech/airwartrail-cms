import type React from "react";
import { useState, useEffect } from "react";
import { formatDuration } from "@/lib/videoData";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Save, CirclePlus } from "lucide-react";
import { toast } from "sonner";

interface Chapter {
  title: string;
  start: number;
  end: number;
}

interface ChapterEditorProps {
  videoId: string;
}

const parseDuration = (duration: string): number => {
  const parts = duration.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else {
    return parts[0];
  }
};

const isValidDuration = (duration: string): boolean => {
  const parts = duration.split(":");
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts.map(Number);
    return (
      !isNaN(hours) &&
      !isNaN(minutes) &&
      !isNaN(seconds) &&
      hours >= 0 &&
      minutes >= 0 &&
      minutes < 60 &&
      seconds >= 0 &&
      seconds < 60
    );
  } else if (parts.length === 2) {
    const [minutes, seconds] = parts.map(Number);
    return (
      !isNaN(minutes) &&
      !isNaN(seconds) &&
      minutes >= 0 &&
      minutes < 60 &&
      seconds >= 0 &&
      seconds < 60
    );
  }
  return false;
};

const ChapterEditor: React.FC<ChapterEditorProps> = ({ videoId }) => {
  const [chapters, setChapters] = useState<Chapter[]>([]);

  useEffect(() => {
    const fetchChapters = async () => {
      try {
        const response = await fetch(`/api/videos/${videoId}/getVideo`);
        const data = await response.json();
        setChapters(data.chapters || []);
      } catch (error) {
        console.error("Error fetching chapters:", error);
      }
    };

    fetchChapters();
  }, [videoId]);

  const handleInputChange = (index: number, field: string, value: string) => {
    const updatedChapters = [...chapters];
    updatedChapters[index][field] = value;
    setChapters(updatedChapters);
  };

  const handleInputBlur = (index: number, field: string) => {
    const updatedChapters = [...chapters];
    const value = updatedChapters[index][field];
    if (field === 'start' || field === 'end') {
      if (!isValidDuration(value)) {
        toast.error('Invalid time format. Use hh:mm:ss');
        return;
      }
      updatedChapters[index][field] = parseDuration(value);
    }
    setChapters(updatedChapters);
  };

  const addChapter = () => {
    setChapters([...chapters, { title: '', start: 0, end: 0 }]);
  };

  const deleteChapter = (index: number) => {
    setChapters(chapters.filter((_, i) => i !== index));
  };

  const saveChapters = async () => {
    try {
      const response = await fetch(`/api/videos/${videoId}/chapters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chapters }),
      });

      if (response.ok) {
        toast.success('Chapters saved successfully');
      } else {
        toast.error('Failed to save chapters');
      }
    } catch (error) {
      console.error("Error saving chapters:", error);
      toast.error('Failed to save chapters');
    }
  };

  return (
    <Card className="col-span-2 w-full">
      <CardHeader>
        <CardTitle>Edit Chapters</CardTitle>
        <CardDescription>
          Chapters are displayed in the timeline and allow viewers to more
          easily navigate through the video. Specify the start and end time and
          title. Time should be formatted in hh:mm:ss
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead className="text-right">Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chapters.map((chapter, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Input
                    value={chapter.title}
                    onChange={(e) => handleInputChange(index, 'title', e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="text"
                    value={chapter.start.toString().includes(':') ? chapter.start : formatDuration(chapter.start)}
                    onChange={(e) => handleInputChange(index, 'start', e.target.value)}
                    onBlur={() => handleInputBlur(index, 'start')}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="text"
                    value={chapter.end.toString().includes(':') ? chapter.end : formatDuration(chapter.end)}
                    onChange={(e) => handleInputChange(index, 'end', e.target.value)}
                    onBlur={() => handleInputBlur(index, 'end')}
                  />
                </TableCell>
                <TableCell className="flex justify-end space-x-2">
                  <Button
                    onClick={() => deleteChapter(index)}
                    variant="destructive"
                  >
                    <X className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="flex flex-row justify-between items-center">
        <Button onClick={addChapter}>
          <CirclePlus className="size-4" />
          Add Chapter
        </Button>
        <Button onClick={saveChapters}>
          <Save className="size-4" />
          Save Chapters
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ChapterEditor;