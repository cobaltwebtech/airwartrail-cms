import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

interface ThumbnailUploadProps {
  videoId: string
}

const ThumbnailUpload: React.FC<ThumbnailUploadProps> = ({ videoId }) => {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)

      // Create a preview URL
      const fileReader = new FileReader()
      fileReader.onload = (e) => {
        setPreview(e.target?.result as string)
      }
      fileReader.readAsDataURL(selectedFile)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file to upload.")
      return
    }

    setLoading(true)
    const formData = new FormData()
    formData.append("file", file)

    try {
      console.log(`Uploading thumbnail for video ${videoId}...`)

      const response = await fetch(`/api/videos/${videoId}/thumbnail`, {
        method: "POST",
        body: formData,
      })

      console.log("Response status:", response.status)

      let result
      try {
        result = await response.json()
      } catch (e) {
        console.error("Failed to parse response as JSON:", e)
        throw new Error("Invalid response from server")
      }

      if (!response.ok) {
        throw new Error(result.message || "Failed to upload thumbnail")
      }

      toast.success("Thumbnail uploaded successfully!")
    } catch (error) {
      console.error("Error uploading thumbnail:", error)
      toast.error(error instanceof Error ? error.message : "Error uploading thumbnail")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Edit Thumbnail</CardTitle>
        <CardDescription>Upload a custom thumbnail to the video.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleUpload()
          }}
        >
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="thumbnail">Thumbnail Upload</Label>
            <Input id="thumbnail" className="border-0 shadow-none file:bg-primary file:rounded-sm file:px-4 file:text-primary-foreground" type="file" accept="image/*" onChange={handleFileChange} />
          </div>
          {preview && (
            <div className="mt-4">
              <Label>Preview</Label>
              <div className="mt-2 rounded-md overflow-hidden border border-gray-200">
                <img
                  src={preview || "/placeholder.svg"}
                  alt="Thumbnail preview"
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          )}
        </form>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button onClick={handleUpload} disabled={loading || !file}>
          {loading ? "Uploading..." : "Upload Thumbnail"}
        </Button>
      </CardFooter>
    </Card>
  )
}

export default ThumbnailUpload
