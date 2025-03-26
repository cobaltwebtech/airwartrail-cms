import { useState, useEffect } from "react";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Folder,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
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

interface CollectionsListProps {
  collections: Collection[] | null | undefined;
}

export function CollectionsList({ collections = [] }: CollectionsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null);

  useEffect(() => {
    // Check if the deletion flag is set in localStorage
    if (localStorage.getItem("collectionDeleted") === "true") {
      toast.success("Collection deleted successfully");
      localStorage.removeItem("collectionDeleted");
    }
    // Check if the upload flag is set in localStorage
    if (localStorage.getItem("collectionUploaded") === "true") {
      toast.success("Collection uploaded successfully");
      localStorage.removeItem("collectionUploaded");
    }    
    // Check if the created flag is set in localStorage
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

  const handleDeleteRequest = (collection: Collection) => {
    console.log('Delete request for collection:', collection);
    setCollectionToDelete(collection);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (collectionToDelete) {
      try {
        const response = await fetch(`/api/collections/${collectionToDelete.guid}/delete`, {
          method: "DELETE",
        });
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

      <CollectionDelete
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filteredCollections.map((collection) => (
          <Card key={collection.guid} className="gap-2 overflow-hidden py-4">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <a href={`/collections/${collection.guid}`} className="cursor-pointer">
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
                    <DropdownMenuItem onClick={() => setSelectedCollection(collection)}>
                      <Pencil className="mr-2 size-4" />
                      <span>Edit Name</span>
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
              <CardDescription>
                Videos: {collection.videoCount}
              </CardDescription>
            </CardContent>
            <CardFooter className="text-muted-foreground p-4 pt-0 text-xs">
               Placeholder text here
            </CardFooter>
          </Card>
        ))}
      </div>

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