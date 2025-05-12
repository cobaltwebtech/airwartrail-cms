import { useState, useEffect } from "react";
import { FileHeader } from "./FileHeader";
import { FileUpload } from "./FileUpload";
import { FilePreview } from "./FilePreview";
import { FileDelete } from "./FileDelete";
import { FileTable } from "./FileTable";
import { DragDropUploader } from "./DragDropUploader";
import { FileIcon } from "lucide-react";
import { toast } from "sonner";

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
  const [currentPath, setCurrentPath] = useState<string>("");
  const [fileStructure, setFileStructure] = useState<R2Item[]>([]);
  const [currentView, setCurrentView] = useState<R2Item[]>([]);
  const [filesToDelete, setFilesToDelete] = useState<string[]>([]);

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

  const handleUploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      console.log(`Uploading file: ${file.name}, size: ${file.size}`);

      const response = await fetch("/api/r2/upload", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          // Important header that helps bypass CSRF protection
          "X-Requested-With": "XMLHttpRequest",
        },
        body: formData,
      });

      console.log("Upload response status:", response.status);

      // Get response text for better error messages
      const responseText = await response.text();
      console.log("Response body:", responseText);

      if (!response.ok) {
        throw new Error(
          `Upload failed: ${responseText || response.statusText}`,
        );
      }

      toast.success("File uploaded successfully");
      setIsUploadDialogOpen(false);
      fetchFiles(); // Refresh the file list
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error(
        `Upload failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  // New function for handling multiple file uploads
  const handleUploadMultiple = async (files: File[]) => {
    let successCount = 0;
    let failCount = 0;

    const uploadPromises = files.map(async (file) => {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/r2/upload", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            // Important header that helps bypass CSRF protection
            "X-Requested-With": "XMLHttpRequest",
          },
          body: formData,
        });

        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        failCount++;
      }
    });

    // Show uploading progress toast
    const uploadingToast = toast.loading(`Uploading ${files.length} files...`);

    try {
      await Promise.all(uploadPromises);

      toast.dismiss(uploadingToast);

      if (successCount > 0) {
        toast.success(`${successCount} files uploaded successfully`);
      }
      if (failCount > 0) {
        toast.error(`${failCount} files failed to upload`);
      }

      fetchFiles(); // Refresh the file list
    } catch {
      toast.dismiss(uploadingToast);
      toast.error("Error uploading files");
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

  const handleDeleteMultipleRequest = (paths: string[]) => {
    setFilesToDelete(paths);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteMultipleConfirm = async (paths: string[]) => {
    try {
      const response = await fetch("/api/r2/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileNames: paths }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete files");
      }

      const data = (await response.json()) as { message?: string };
      toast.success(
        data.message || `${paths.length} files deleted successfully`,
      );
      fetchFiles(); // Refresh the file list
    } catch (error) {
      console.error("Error deleting files:", error);
      toast.error("Failed to delete files");
    } finally {
      setIsDeleteDialogOpen(false);
      setFilesToDelete([]);
    }
  };

  const r2BucketUrl = import.meta.env.PUBLIC_R2_BUCKET_URL;

  const handleCopy = (file: R2File) => {
    navigator.clipboard.writeText(
      `${r2BucketUrl}/${encodeURIComponent(file.name)}`,
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

  const handlePreview = (file: R2File) => {
    setSelectedFile(file);
    setIsPreviewOpen(true);
  };

  return (
    <DragDropUploader
      onUpload={handleUploadFile}
      onMultipleUpload={handleUploadMultiple}
    >
      <div className="space-y-4">
        <FileHeader
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sortCriteria={sortCriteria}
          setSortCriteria={setSortCriteria}
          sortDirection={sortDirection}
          toggleSortDirection={toggleSortDirection}
          onUploadClick={() => setIsUploadDialogOpen(true)}
        />

        {/* R2 Objects Table */}
        <FileTable
          currentView={currentView}
          currentPath={currentPath}
          isLoading={isLoading}
          files={files}
          formatFileSize={formatFileSize}
          formatDate={formatDate}
          navigateToDirectory={navigateToDirectory}
          handleCopy={handleCopy}
          handleDeleteRequest={handleDeleteRequest}
          handlePreview={handlePreview}
          onDeleteMultipleRequest={handleDeleteMultipleRequest}
        />

        {!isLoading && files.length === 0 && (
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

        {/* Dialogs */}
        <FileUpload
          isOpen={isUploadDialogOpen}
          onOpenChange={setIsUploadDialogOpen}
          onUpload={handleUploadFile}
          onMultipleUpload={handleUploadMultiple}
          formatFileSize={formatFileSize}
        />

        <FilePreview
          isOpen={isPreviewOpen}
          onOpenChange={setIsPreviewOpen}
          selectedFile={selectedFile}
          handleCopy={handleCopy}
          formatFileSize={formatFileSize}
          formatDate={formatDate}
        />

        <FileDelete
          isOpen={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          fileToDelete={fileToDelete}
          filesToDelete={filesToDelete}
          onConfirm={handleDeleteConfirm}
          onConfirmMultiple={handleDeleteMultipleConfirm}
          formatFileSize={formatFileSize}
        />
      </div>
    </DragDropUploader>
  );
}
