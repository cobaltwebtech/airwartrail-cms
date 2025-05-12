import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Trash2,
  Eye,
  Copy,
  FileIcon,
  FolderOpen,
} from "lucide-react";

interface R2Directory {
  name: string;
  path: string;
  isDirectory: true;
  children: (R2File | R2Directory)[];
}

interface R2File {
  name: string;
  size: number;
  uploaded: string;
  etag: string;
  httpEtag: string;
  url: string;
  path: string;
  isDirectory: false;
  contentType?: string;
}

type R2Item = R2File | R2Directory;

interface FileTableProps {
  currentView: R2Item[];
  currentPath: string;
  isLoading: boolean;
  files: R2File[];
  formatFileSize: (bytes: number) => string;
  formatDate: (dateStr: string) => string;
  navigateToDirectory: (path: string) => void;
  handleCopy: (file: R2File) => void;
  handleDeleteRequest: (file: R2File) => void;
  handlePreview: (file: R2File) => void;
  handleDeleteMultiple?: (filePaths: string[]) => void;
  onDeleteMultipleRequest?: (filePaths: string[]) => void; // New prop
}

export function FileTable({
  currentView,
  currentPath,
  isLoading,
  files,
  formatFileSize,
  formatDate,
  navigateToDirectory,
  handleCopy,
  handleDeleteRequest,
  handlePreview,
  handleDeleteMultiple,
  onDeleteMultipleRequest,
}: FileTableProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const isAllSelected =
    currentView.length > 0 &&
    currentView.filter((item) => !item.isDirectory).length ===
      [...selectedItems].filter((path) =>
        currentView.some((item) => !item.isDirectory && item.path === path),
      ).length;

  const hasSelected = selectedItems.size > 0;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all files in current view
      const newSelection = new Set(selectedItems);
      currentView.forEach((item) => {
        if (!item.isDirectory) {
          newSelection.delete(item.path);
        }
      });
      setSelectedItems(newSelection);
    } else {
      // Select all files in current view
      const newSelection = new Set(selectedItems);
      currentView.forEach((item) => {
        if (!item.isDirectory) {
          newSelection.add(item.path);
        }
      });
      setSelectedItems(newSelection);
    }
  };

  const toggleSelectItem = (path: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(path)) {
      newSelection.delete(path);
    } else {
      newSelection.add(path);
    }
    setSelectedItems(newSelection);
  };

  const handleDeleteSelected = () => {
    if (selectedItems.size > 0) {
      const selectedPaths = Array.from(selectedItems);

      // If we have a request handler, use that instead for confirmation
      if (onDeleteMultipleRequest) {
        onDeleteMultipleRequest(selectedPaths);
      }
      // Otherwise use direct deletion if available
      else if (handleDeleteMultiple) {
        handleDeleteMultiple(selectedPaths);
      }

      // Don't clear selection here - will be cleared after successful deletion
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-full">
      {hasSelected && (
        <div className="bg-muted mb-2 flex items-center gap-2 rounded p-2">
          <Checkbox checked={isAllSelected} onCheckedChange={toggleSelectAll} />
          <div className="text-sm">
            <span className="font-medium">{selectedItems.size} selected</span>
          </div>
          <div className="ml-auto flex gap-2">
            {(handleDeleteMultiple || onDeleteMultipleRequest) && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Delete Selected
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedItems(new Set())}
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      <Table className="mb-4">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead className="w-[300px]">Name</TableHead>
            <TableHead className="w-[100px]">Size</TableHead>
            <TableHead className="w-[150px]">Uploaded</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Add breadcrumb navigation */}
          {currentPath && (
            <TableRow>
              <TableCell colSpan={5}>
                <div className="flex items-center gap-1">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => navigateToDirectory("")}
                    className="px-2"
                  >
                    Home
                  </Button>
                  {currentPath.split("/").map((part, index, array) => {
                    const pathToThis = array.slice(0, index + 1).join("/");
                    return (
                      <div key={pathToThis} className="flex items-center">
                        <span>/</span>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => navigateToDirectory(pathToThis)}
                          className="px-2"
                        >
                          {part}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </TableCell>
            </TableRow>
          )}

          {/* Show current directory items */}
          {currentView.map((item) => (
            <TableRow
              key={item.path}
              className={
                selectedItems.has(item.path) ? "bg-muted/50" : undefined
              }
            >
              <TableCell>
                {!item.isDirectory && (
                  <Checkbox
                    checked={selectedItems.has(item.path)}
                    onCheckedChange={() => toggleSelectItem(item.path)}
                    aria-label={`Select ${item.name}`}
                  />
                )}
              </TableCell>
              <TableCell>
                {item.isDirectory ? (
                  <div
                    className="hover:text-primary flex cursor-pointer items-center gap-2"
                    onClick={() => navigateToDirectory(item.path)}
                  >
                    <FolderOpen className="size-5 text-yellow-500" />
                    {item.name}
                  </div>
                ) : (
                  <div
                    className="flex cursor-pointer items-center gap-2"
                    onClick={() => {
                      const fullFile = files.find((f) => f.name === item.path);
                      if (fullFile) {
                        handlePreview(fullFile);
                      }
                    }}
                  >
                    <FileIcon className="size-5" />
                    {item.name}
                  </div>
                )}
              </TableCell>
              <TableCell>
                {item.isDirectory ? (
                  <span className="text-muted-foreground">Directory</span>
                ) : (
                  formatFileSize(item.size)
                )}
              </TableCell>
              <TableCell>
                {item.isDirectory ? (
                  <span className="text-muted-foreground">-</span>
                ) : (
                  formatDate(item.uploaded)
                )}
              </TableCell>
              <TableCell>
                {!item.isDirectory && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() =>
                          handleCopy(files.find((f) => f.name === item.path)!)
                        }
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy URL
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const fullFile = files.find(
                            (f) => f.name === item.path,
                          );
                          if (fullFile) {
                            handlePreview(fullFile);
                          }
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleDeleteRequest(
                            files.find((f) => f.name === item.path)!,
                          )
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
