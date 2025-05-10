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
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
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
  DialogFooter
} from "@/components/ui/dialog";

// Define the type for R2 file objects
interface R2File {
  name: string;
  size: number;
  uploaded: string;
  etag: string;
  httpEtag: string;
  url: string;
  contentType?: string;
}

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
      // Assert the type of data to ensure it has a 'files' property
      setFiles((data as { files: R2File[] }).files);
    } catch (error) {
      console.error("Error fetching files:", error);
      toast.error("Failed to load files");
    } finally {
      setIsLoading(false);
    }
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
    navigator.clipboard.writeText(`${window.location.origin}/api/r2/file/${encodeURIComponent(file.name)}`);
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
    return file.contentType?.startsWith("image/") || 
           /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
  };

  const filteredFiles = files
    .filter((file) =>
      file.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortCriteria === "name") {
        return sortDirection === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else if (sortCriteria === "size") {
        return sortDirection === "asc"
          ? a.size - b.size
          : b.size - a.size;
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

      {/* File Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredFiles.map((file) => (
            <Card key={file.name} className="overflow-hidden">
              <div className="relative">
                {isImageFile(file) ? (
                  <div className="aspect-video bg-secondary">
                    <img
                      src={`/api/r2/file/${encodeURIComponent(file.name)}`}
                      alt={file.name}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-secondary">
                    <FileIcon className="h-16 w-16" />
                  </div>
                )}
              </div>
              <CardHeader className="p-4">
                <div className="flex items-start justify-between">
                  <div className="truncate">
                    <CardTitle className="truncate text-base">
                      {file.name}
                    </CardTitle>
                    <CardDescription>
                      {formatFileSize(file.size)}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem 
                        onClick={() => {
                          setSelectedFile(file);
                          setIsPreviewOpen(true);
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        <span>Preview</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleCopy(file)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        <span>Copy URL</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a
                          href={`/api/r2/file/${encodeURIComponent(file.name)}`}
                          download={file.name}
                          className="flex cursor-pointer items-center px-2 py-1.5 text-sm"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          <span>Download</span>
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteRequest(file)}
                      >
                        <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                        <span className="text-destructive">Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardFooter className="p-4 pt-0 text-xs text-muted-foreground">
                Uploaded on {formatDate(file.uploaded)}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && filteredFiles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileIcon className="mb-4 h-12 w-12 text-muted-foreground" />
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
              <div className="rounded-md bg-secondary p-2 text-sm">
                <p className="font-semibold">{uploadFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(uploadFile.size)}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={handleFileUpload} 
              disabled={!uploadFile}
            >
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        {selectedFile && (
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="truncate">{selectedFile.name}</DialogTitle>
              <DialogDescription>
                {formatFileSize(selectedFile.size)} • Uploaded on {formatDate(selectedFile.uploaded)}
              </DialogDescription>
            </DialogHeader>
            <div className="flex h-96 items-center justify-center overflow-hidden rounded-md bg-secondary">
              {isImageFile(selectedFile) ? (
                <img
                  src={`/api/r2/file/${encodeURIComponent(selectedFile.name)}`}
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
                  href={`/api/r2/file/${encodeURIComponent(selectedFile.name)}`}
                  download={selectedFile.name}
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
              Are you sure you want to delete this file? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {fileToDelete && (
            <div className="rounded-md bg-secondary p-3">
              <p className="font-medium">{fileToDelete.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(fileToDelete.size)}
              </p>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}