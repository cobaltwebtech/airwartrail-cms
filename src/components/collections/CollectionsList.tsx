import { useState, useEffect } from "react";
import { MoreHorizontal, Pencil, Trash2, Eye, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { Collection } from "@/types";
import { toast } from "sonner";
import { CollectionDelete } from "./CollectionDelete";
import { CollectionTitle } from "./CollectionTitle";
import { convertToGb } from "@/lib/videoData";

interface CollectionsListProps {
  collections: Collection[] | null | undefined;
}

export function CollectionsList({ collections = [] }: CollectionsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isTitleDialogOpen, setIsTitleDialogOpen] = useState(false);
  const [collectionToUpdate, setCollectionToUpdate] =
    useState<Collection | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [collectionToDelete, setCollectionToDelete] =
    useState<Collection | null>(null);

  useEffect(() => {
    // Check if the deletion flag is set in localStorage
    if (localStorage.getItem("titleUpdated") === "true") {
      toast.success("Collection title updated");
      localStorage.removeItem("titleUpdated");
    }
    if (localStorage.getItem("collectionDeleted") === "true") {
      toast.success("Collection deleted successfully");
      localStorage.removeItem("collectionDeleted");
    }
    if (localStorage.getItem("collectionUploaded") === "true") {
      toast.success("Collection uploaded successfully");
      localStorage.removeItem("collectionUploaded");
    }
    if (localStorage.getItem("collectionCreated") === "true") {
      toast.success("New collection created successfully");
      localStorage.removeItem("collectionCreated");
    }
  }, []);

  // Ensure collections is an array before filtering
  const collectionArray = Array.isArray(collections) ? collections : [];

  const filteredCollections = collectionArray.filter((collection) =>
    collection.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleTitleRequest = (collection: Collection) => {
    setCollectionToUpdate(collection);
    setIsTitleDialogOpen(true);
  };

  const handleTitleUpdate = async (title: string) => {
    if (collectionToUpdate) {
      try {
        const response = await fetch(
          `/api/collections/${collectionToUpdate.guid}/titleUpdate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ name: title }),
          },
        );
        if (!response.ok) {
          throw new Error("Failed to update title");
        }
        // Set a flag in localStorage to indicate the collection title was updated successfully
        localStorage.setItem("titleUpdated", "true");
        window.location.reload();
      } catch (error) {
        console.error("Error updating title:", error);
        toast.error("Failed to update title");
      } finally {
        setIsTitleDialogOpen(false);
      }
    }
  };
  const handleDeleteRequest = (collection: Collection) => {
    console.log("Delete request for collection:", collection);
    setCollectionToDelete(collection);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (collectionToDelete) {
      try {
        const response = await fetch(
          `/api/collections/${collectionToDelete.guid}/delete`,
          {
            method: "DELETE",
          },
        );
        if (!response.ok) {
          throw new Error("Failed to delete collection");
        }
        // Set a flag in localStorage to indicate the collection was deleted successfully
        localStorage.setItem("collectionDeleted", "true");
        window.location.reload();
      } catch (error) {
        console.error("Error deleting collection:", error);
        toast.error("Failed to delete collection");
      } finally {
        setIsDeleteDialogOpen(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search collections..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filteredCollections.map((collection) => (
          <Card key={collection.guid} className="gap-2 overflow-hidden py-4">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <a
                  href={`/collections/${collection.guid}`}
                  className="cursor-pointer"
                >
                  <CardTitle className="text-base text-wrap">
                    {collection.name}
                  </CardTitle>
                </a>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <a
                        href={`/collections/${collection.guid}`}
                        className="flex cursor-pointer items-center px-2 py-1.5 text-sm"
                      >
                        <Eye className="mr-2 size-4" />
                        <span>View</span>
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleTitleRequest(collection)}
                    >
                      <Pencil className="mr-2 size-4" />
                      <span>Edit Title</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDeleteRequest(collection)}
                    >
                      <Trash2 className="text-destructive-foreground mr-2 size-4" />
                      <span className="text-destructive">Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <CardDescription>Videos: {collection.videoCount}</CardDescription>
              <CardDescription>Storage Size: {convertToGb(collection.totalSize)}GB</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
      <CollectionTitle
        open={isTitleDialogOpen}
        onOpenChange={setIsTitleDialogOpen}
        onConfirm={handleTitleUpdate}
      />
      <CollectionDelete
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
      />
      {filteredCollections.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Folder className="text-muted-foreground mb-4 h-12 w-12" />
          <h3 className="text-lg font-medium">No collections found</h3>
          <p className="text-muted-foreground">
            {searchTerm
              ? "Try a different search term"
              : "Create your first collection to get started"}
          </p>
        </div>
      )}
    </div>
  );
}
