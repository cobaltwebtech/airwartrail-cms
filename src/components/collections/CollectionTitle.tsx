import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

interface TitleUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (newTitle: string) => Promise<void>;
}

export function CollectionTitle({
  open,
  onOpenChange,
  onConfirm,
}: TitleUpdateDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    if (title.trim() === "") {
      setError("Title cannot be empty");
      return;
    }

    setIsLoading(true);
    try {
      await onConfirm(title);
    } catch {
      toast.error("Failed to update title");
    } finally {
      setIsLoading(false);
      onOpenChange(false); // Close the dialog after the operation
      setTitle(""); // Clear the input field
      setError(""); // Clear the error message
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Collection Title</DialogTitle>
          <DialogDescription>
            Enter new collection title below.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="text"
          id="title"
          name="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(""); // Clear the error message on input change
          }}
          placeholder="New collection title"
        />
        {error && <p className="mt-2 text-red-500">{error}</p>}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={isLoading}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || title.trim() === ""}
          >
            {isLoading ? (
              <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              "Save Title"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
