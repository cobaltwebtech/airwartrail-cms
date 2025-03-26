import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectGroup, SelectLabel, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Pencil } from "lucide-react";

interface CollectionEditorProps {
  collectionId: string;
  onUpdateCollectionId: (newCollectionId: string) => void;
  collections: { guid: string; name: string }[];
}

const CollectionEditor: React.FC<CollectionEditorProps> = ({ collectionId, onUpdateCollectionId, collections }) => {
  const [selectedCollectionId, setSelectedCollectionId] = useState(collectionId);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSave = () => {
    onUpdateCollectionId(selectedCollectionId);
    setDialogOpen(false);
  };

  return (
    <Card className="col-span-2 w-full justify-between">
      <CardHeader>
        <CardTitle>Edit Collection</CardTitle>
        <CardDescription>
          Select a collection for the video.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)}>
          <DialogTrigger asChild>
            <div className="">
              <Button onClick={() => setDialogOpen(true)}><Pencil className="size-4" />
                Edit Collection
              </Button>
            </div>
          </DialogTrigger>
          <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Video Collection</DialogTitle>
            <DialogDescription>Select a collection for the video.</DialogDescription>
            </DialogHeader>
            <Label htmlFor="collection-select">Select Collection:</Label>
            <Select
              id="collection-select"
              value={selectedCollectionId}
              onChange={(value) => setSelectedCollectionId(value)}
            >
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Collection List</SelectLabel>
              {collections.map((collection) => (
                <SelectItem key={collection.guid} value={collection.guid}>
                  {collection.name}
                  </SelectItem>
              ))}
                              </SelectGroup>
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button onClick={handleSave}>Save</Button>
              <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default CollectionEditor;