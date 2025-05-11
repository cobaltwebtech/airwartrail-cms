import { useState, useEffect } from "react";
import {
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Trash2,
  Download,
  Eye,
  Copy,
  FileIcon,
  FolderOpen,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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

// Add this function to organize files into a directory structure
const organizeFilesIntoStructure = (files: R2File[]): R2Item[] => {
  const structure: Record<string, R2Directory> = {};
  const root: R2Item[] = [];

  // First pass: create all directory objects
  files.forEach((file) => {
    const pathParts = file.name.split("/");

    // Skip empty parts (happens with trailing slashes)
    const filteredParts = pathParts.filter((part) => part !== "");

    let currentPath = "";

    // Create directory entries for each level
    for (let i = 0; i < filteredParts.length - 1; i++) {
      const part = filteredParts[i];
      const parentPath = currentPath;

      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!structure[currentPath]) {
        structure[currentPath] = {
          name: part,
          path: currentPath,
          isDirectory: true,
          children: [],
        };

        // Add to parent or root
        if (parentPath) {
          if (structure[parentPath]) {
            structure[parentPath].children.push(structure[currentPath]);
          }
        } else {
          root.push(structure[currentPath]);
        }
      }
    }
  });

  // Second pass: add files to their parent directories or root
  files.forEach((file) => {
    const pathParts = file.name.split("/").filter((part) => part !== "");
    const fileName = pathParts[pathParts.length - 1];
    const parentPath =
      pathParts.length > 1 ? pathParts.slice(0, -1).join("/") : "";

    const fileObj: R2File = {
      ...file,
      name: fileName,
      path: file.name,
      isDirectory: false,
    };

    if (parentPath && structure[parentPath]) {
      structure[parentPath].children.push(fileObj);
    } else if (pathParts.length === 1) {
      // This is a file at the root level
      root.push(fileObj);
    }
  });

  return root;
};

export function FileList() {
  const [files, setFiles] = useState<R2File[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sortCriteria, setSortCriteria] = useState("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<R2File | null>(null);
  const [selectedFile, setSelectedFile] = useState<R2File | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [fileStructure, setFileStructure] = useState<R2Item[]>([]);
  const [currentView, setCurrentView] = useState<R2Item[]>([]);

  // Fetch files on component mount
  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/r2/list");
      if (!response.ok) {
        throw new Error("Failed to fetch files");
      }
      const data = await response.json();
      const fileList = (data as { files: R2File[] }).files;

      // Organize into directory structure
      const structure = organizeFilesIntoStructure(fileList);
      setFileStructure(structure);

      // Initially view root items
      updateCurrentView(structure, "");

      setFiles(fileList); // Keep original flat list for compatibility
    } catch (error) {
      console.error("Error fetching files:", error);
      toast.error("Failed to load files");
    } finally {
      setIsLoading(false);
    }
  };

  const updateCurrentView = (structure: R2Item[], path: string) => {
    if (!path) {
      // At root, show top-level items
      setCurrentView(structure);
      return;
    }

    // Find the directory at the specified path
    const findDirectory = (
      items: R2Item[],
      searchPath: string,
    ): R2Directory | null => {
      for (const item of items) {
        if (item.isDirectory && item.path === searchPath) {
          return item;
        }
        if (item.isDirectory) {
          const found = findDirectory(item.children, searchPath);
          if (found) return found;
        }
      }
      return null;
    };

    const directory = findDirectory(structure, path);
    if (directory) {
      setCurrentView(directory.children);
    } else {
      // Fallback to root if directory not found
      setCurrentView(structure);
    }
  };

  const navigateToDirectory = (dirPath: string) => {
    setCurrentPath(dirPath);
    updateCurrentView(fileStructure, dirPath);
  };

  const navigateUp = () => {
    const pathParts = currentPath.split("/");
    pathParts.pop();
    const parentPath = pathParts.join("/");
    setCurrentPath(parentPath);
    updateCurrentView(fileStructure, parentPath);
  };

  const handleFileUpload = async () => {
    if (!uploadFile) {
      toast.error("No file selected");
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadFile);

    try {
      const response = await fetch("/api/r2/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      toast.success("File uploaded successfully");
      setIsUploadDialogOpen(false);
      setUploadFile(null);
      fetchFiles(); // Refresh the file list
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload file");
    }
  };

  const handleDeleteRequest = (file: R2File) => {
    setFileToDelete(file);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (fileToDelete) {
      try {
        const response = await fetch("/api/r2/delete", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fileName: fileToDelete.name }),
        });

        if (!response.ok) {
          throw new Error("Failed to delete file");
        }

        toast.success("File deleted successfully");
        fetchFiles(); // Refresh the file list
      } catch (error) {
        console.error("Error deleting file:", error);
        toast.error("Failed to delete file");
      } finally {
        setIsDeleteDialogOpen(false);
      }
    }
  };

  const handleCopy = (file: R2File) => {
    navigator.clipboard.writeText(
      `https://pub-86eb8ad6a19944efb996fc447640b752.r2.dev/${encodeURIComponent(file.name)}`,
    );
    toast.success("URL copied to clipboard");
  };

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isImageFile = (file: R2File) => {
    const fileName = file.path || file.name;
    return (
      file.contentType?.startsWith("image/") ||
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName)
    );
  };

  const filteredFiles = files
    .filter((file) =>
      file.name.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      if (sortCriteria === "name") {
        return sortDirection === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else if (sortCriteria === "size") {
        return sortDirection === "asc" ? a.size - b.size : b.size - a.size;
      } else {
        return sortDirection === "asc"
          ? new Date(a.uploaded).getTime() - new Date(b.uploaded).getTime()
          : new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime();
      }
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-2">
        <Input
          placeholder="Search files..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-x-4">
          <Button variant="outline" onClick={() => setIsUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload File
          </Button>
          <Select value={sortCriteria} onValueChange={setSortCriteria}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Sort by Date</SelectItem>
              <SelectItem value="name">Sort by Name</SelectItem>
              <SelectItem value="size">Sort by Size</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={toggleSortDirection}>
            {sortDirection === "asc" ? <ArrowUp /> : <ArrowDown />}
          </Button>
        </div>
      </div>

      {/* R2 Objects Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"></div>
        </div>
      ) : (
        <div className="max-w-full">
          <Table className="mb-4">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Name</TableHead>
                <TableHead className="w-[100px]">Size</TableHead>
                <TableHead className="w-[100px]">Uploaded</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Add breadcrumb navigation */}
              {currentPath && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
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
                              variant="ghost"
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
                <TableRow key={item.path}>
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
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => {
                          // Find the original file object with all properties
                          const fullFile = files.find(
                            (f) => f.name === item.path,
                          );
                          if (fullFile) {
                            setSelectedFile(fullFile);
                            setIsPreviewOpen(true);
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
                              handleCopy(
                                files.find((f) => f.name === item.path)!,
                              )
                            }
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy URL
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              // Find the original file object with all properties
                              const fullFile = files.find(
                                (f) => f.name === item.path,
                              );
                              if (fullFile) {
                                setSelectedFile(fullFile);
                                setIsPreviewOpen(true);
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
      )}

      {!isLoading && filteredFiles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileIcon className="text-muted-foreground mb-4 h-12 w-12" />
          <h3 className="text-lg font-medium">No files found</h3>
          <p className="text-muted-foreground">
            {searchTerm
              ? "Try a different search term"
              : "Upload your first file to get started"}
          </p>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>
              Select a file to upload to your R2 storage
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              id="file-upload"
              type="file"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
            {uploadFile && (
              <div className="bg-secondary rounded-md p-2 text-sm">
                <p className="font-semibold">{uploadFile.name}</p>
                <p className="text-muted-foreground text-xs">
                  {formatFileSize(uploadFile.size)}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleFileUpload} disabled={!uploadFile}>
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        {selectedFile && (
          <DialogContent className="sm:max-w-screen-xl">
            <DialogHeader>
              <DialogTitle className="truncate">
                {selectedFile.name}
              </DialogTitle>
              <DialogDescription>
                {formatFileSize(selectedFile.size)} | Uploaded on{" "}
                {formatDate(selectedFile.uploaded)}
              </DialogDescription>
            </DialogHeader>
            <div className="bg-secondary flex h-96 items-center justify-center overflow-hidden rounded-md">
              {isImageFile(selectedFile) ? (
                <img
                  src={`https://pub-86eb8ad6a19944efb996fc447640b752.r2.dev/${encodeURIComponent(selectedFile.name)}`}
                  alt={selectedFile.name}
                  className="h-full max-h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <FileIcon className="h-24 w-24" />
                  <p>Preview not available</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleCopy(selectedFile)}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy URL
              </Button>
              <Button asChild>
                <a
                  href={`https://pub-86eb8ad6a19944efb996fc447640b752.r2.dev/${encodeURIComponent(selectedFile.name)}`}
                  download
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this file? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {fileToDelete && (
            <div className="bg-secondary rounded-md p-3">
              <p className="font-medium">{fileToDelete.name}</p>
              <p className="text-muted-foreground text-sm">
                {formatFileSize(fileToDelete.size)}
              </p>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
