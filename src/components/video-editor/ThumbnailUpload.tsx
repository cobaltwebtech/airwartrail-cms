import { Upload } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ThumbnailUploadProps {
	videoId: string;
}

const ThumbnailUpload: React.FC<ThumbnailUploadProps> = ({ videoId }) => {
	const [file, setFile] = useState<File | null>(null);
	const [loading, setLoading] = useState(false);
	const [preview, setPreview] = useState<string | null>(null);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			const selectedFile = e.target.files[0];
			setFile(selectedFile);

			// Create a preview URL
			const fileReader = new FileReader();
			fileReader.onload = (e) => {
				if (typeof e.target?.result === 'string') {
					setPreview(e.target.result);
				}
			};
			fileReader.readAsDataURL(selectedFile);
		}
	};

	const handleUpload = async () => {
		if (!file) {
			toast.error('Please select a file to upload.');
			return;
		}

		setLoading(true);
		const formData = new FormData();
		formData.append('file', file);

		try {
			console.log(`Uploading thumbnail for video ${videoId}...`);

			const response = await fetch(`/api/videos/${videoId}/thumbnail`, {
				method: 'POST',
				body: formData,
			});

			console.log('Response status:', response.status);

			let result: { message?: string };
			try {
				result = await response.json();
			} catch (e) {
				console.error('Failed to parse response as JSON:', e);
				throw new Error('Invalid response from server');
			}

			if (!response.ok) {
				throw new Error(result.message || 'Failed to upload thumbnail');
			}

			toast.success('Thumbnail uploaded successfully!');
		} catch (error) {
			console.error('Error uploading thumbnail:', error);
			toast.error(
				error instanceof Error ? error.message : 'Error uploading thumbnail',
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card className="col-span-2 w-full justify-between">
			<CardHeader>
				<CardTitle>Edit Thumbnail</CardTitle>
				<CardDescription>
					Upload a custom thumbnail to the video.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleUpload();
					}}
				>
					<Input
						id="thumbnail"
						className="file:bg-primary file:text-primary-foreground border-0 bg-transparent shadow-none file:rounded-sm file:px-4"
						type="file"
						accept="image/*"
						onChange={handleFileChange}
					/>
					{preview && (
						<div className="mt-4">
							<Label>Preview</Label>
							<div className="mt-2 overflow-hidden rounded-md border border-gray-200">
								<img
									src={preview || '/placeholder.svg'}
									alt="Thumbnail preview"
									className="h-auto w-full object-cover"
								/>
							</div>
						</div>
					)}
				</form>
			</CardContent>
			<CardFooter className="">
				<Button onClick={handleUpload} disabled={loading || !file}>
					<Upload className="size-4" />
					{loading ? 'Uploading...' : 'Upload Thumbnail'}
				</Button>
			</CardFooter>
		</Card>
	);
};

export default ThumbnailUpload;
