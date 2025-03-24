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
import { Pencil, Trash2, Upload, CirclePlus } from "lucide-react";
import { toast } from "sonner";

interface ChapterEditorProps {
  videoId: string;
}

const ChapterEditor: React.FC<ChapterEditorProps> = ({ videoId }) => {
  const [chapters, setChapters] = useState([]);

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

  const addChapter = () => {
    // Logic to add a new chapter
  };

  const editChapter = (index) => {
    // Logic to edit a chapter
  };

  const deleteChapter = (index) => {
    // Logic to delete a chapter
  };

  return (
    <Card className="col-span-2 w-full">
      <CardHeader>
        <CardTitle>Edit Chapters</CardTitle>
        <CardDescription>
          Chapters are displayed in the timeline and allow viewers to more
          easily navigate through the video. Specify the start and end time and
          title. Time should be formated in hh:mm:ss
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chapters.map((chapter, index) => (
              <TableRow key={index}>
                <TableCell>{chapter.title}</TableCell>
                <TableCell>{formatDuration(chapter.start)}</TableCell>
                <TableCell>{formatDuration(chapter.end)}</TableCell>
                <TableCell className="flex justify-end space-x-2">
                  <Button onClick={() => editChapter(index)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    onClick={() => deleteChapter(index)}
                    variant="destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        <Button onClick={addChapter}>
          <CirclePlus className="size-4" />
          Add Chapter
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ChapterEditor;
