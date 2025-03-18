import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

interface CaptionEditorProps {
  videoId: string
}

const CaptionEditor: React.FC<CaptionEditorProps> = ({ videoId }) => {
  const [file, setFile] = useState<File | null>(null)
  const [captionLabel, setCaptionLabel] = useState<string>("")
  const [languageCode, setLanguageCode] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]

      // Validate file type
      const validExtensions = ['.srt', '.vtt']
      const fileExtension = selectedFile.name.slice(selectedFile.name.lastIndexOf('.')).toLowerCase()
      
      if (!validExtensions.includes(fileExtension)) {
        toast.error("File must be a .srt or .vtt file")
        console.log("Invalid file type:", selectedFile.type, "or extension:", fileExtension)
        return
      }

      setFile(selectedFile)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file to upload.")
      return
    }

    if (!captionLabel) {
      toast.error("Please enter a label.")
      return
    }

    if (!languageCode) {
      toast.error("Please enter a language code.")
      return
    }

    setLoading(true)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("label", captionLabel)
    formData.append("srclang", languageCode)

    try {
      console.log(`Uploading caption for video ${videoId}...`)

      const response = await fetch(`/api/videos/${videoId}/captions`, {
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
        throw new Error(result.message || "Failed to upload caption")
      }

      toast.success("Caption uploaded successfully!")
    } catch (error) {
      console.error("Error uploading caption:", error)
      toast.error(error instanceof Error ? error.message : "Error uploading caption")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Caption</CardTitle>
        <CardDescription>Upload a caption file to the video.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleUpload()
          }}
        >
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="caption">Upload Caption File</Label>
            <Input id="caption" type="file" accept=".vtt,.srt" onChange={handleFileChange} />

            <Label htmlFor="label">Label</Label>
            <Input id="label" type="text" value={captionLabel} onChange={(e) => setCaptionLabel(e.target.value)} />

            <Label htmlFor="srclang">Language Code</Label>
            <Input id="srclang" type="text" value={languageCode} onChange={(e) => setLanguageCode(e.target.value)} />
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button onClick={handleUpload} disabled={loading || !file}>
          {loading ? "Uploading..." : "Upload Caption"}
        </Button>
      </CardFooter>
    </Card>
  )
}

export default CaptionEditor