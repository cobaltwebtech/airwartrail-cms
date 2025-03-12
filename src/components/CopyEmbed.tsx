import { useState } from "react";
import { Check, Copy, Loader2 } from 'lucide-react';
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import { generateEmbedCode, generateSecureEmbedCode } from "../lib/embed";

interface CopyEmbedProps {
  videoId: string;
  title: string;
  trigger?: React.ReactNode;
}

export function CopyEmbed({ videoId, title, trigger }: CopyEmbedProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [embedCode, setEmbedCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate embed code when dialog opens
  const handleOpenChange = async (newOpen: boolean) => {
    setOpen(newOpen);
    
    if (newOpen) {
      setIsLoading(true);
      setError(null);
      setCopied(false);
      
      try {
        // First, set a basic embed code while we fetch the secure URL
        const basicEmbedCode = generateEmbedCode(videoId, title);
        setEmbedCode(basicEmbedCode);
        
        // Fetch the secure URL from our API
        const response = await fetch(`/api/videos/${videoId}/secure-url`);
        
        if (!response.ok) {
          throw new Error("Failed to get secure video URL");
        }
        
        const data = await response.json();
        
        // Update with secure embed code
        const secureEmbedCode = generateSecureEmbedCode(videoId, title, data.url);
        setEmbedCode(secureEmbedCode);
      } catch (err) {
        console.error("Error generating embed code:", err);
        setError("Could not generate secure embed code. Using basic embed code instead.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Copy to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Get Embed Code</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Embed Video</DialogTitle>
          <DialogDescription>
            Copy this code to embed the video on your website.
            {error && <p className="text-yellow-500 mt-2">{error}</p>}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Generating secure embed code...</span>
            </div>
          ) : (
            <Textarea 
              value={embedCode} 
              readOnly 
              className="font-mono text-sm h-[150px]" 
            />
          )}
        </div>
        
        <DialogFooter>
          <Button 
            onClick={copyToClipboard} 
            disabled={isLoading || !embedCode}
            className="w-[120px]"
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy Code
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}