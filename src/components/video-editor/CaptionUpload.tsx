import type React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
	Table,
	TableHeader,
	TableBody,
	TableRow,
	TableCell,
	TableHead,
} from '@/components/ui/table';
import { Trash2, Upload } from 'lucide-react';
import DeleteCaption from './CaptionDelete';

interface CaptionUploadProps {
	videoId: string;
	initialCaptions: { label: string; srclang: string }[];
}

const CaptionUpload: React.FC<CaptionUploadProps> = ({
	videoId,
	initialCaptions,
}) => {
	const [file, setFile] = useState<File | null>(null);
	const [captionLabel, setCaptionLabel] = useState<string>('');
	const [languageCode, setLanguageCode] = useState<string>('');
	const [loading, setLoading] = useState(false);
	const [captions, setCaptions] = useState(initialCaptions);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [captionToDelete, setCaptionToDelete] = useState<string | null>(null);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			const selectedFile = e.target.files[0];

			// Validate file type
			const validExtensions = ['.srt', '.vtt'];
			const fileExtension = selectedFile.name
				.slice(selectedFile.name.lastIndexOf('.'))
				.toLowerCase();

			if (!validExtensions.includes(fileExtension)) {
				toast.error('File must be a .srt or .vtt file');
				console.log(
					'Invalid file type:',
					selectedFile.type,
					'or extension:',
					fileExtension,
				);
				return;
			}

			setFile(selectedFile);
		}
	};

	const handleUpload = async () => {
		if (!file) {
			toast.error('Please select a file to upload.');
			return;
		}

		if (!captionLabel) {
			toast.error('Please enter a label.');
			return;
		}

		if (!languageCode) {
			toast.error('Please enter a language code.');
			return;
		}

		setLoading(true);
		const formData = new FormData();
		formData.append('file', file);
		formData.append('label', captionLabel);
		formData.append('srclang', languageCode);

		try {
			console.log(`Uploading caption for video ${videoId}...`);

			const response = await fetch(`/api/videos/${videoId}/captions`, {
				method: 'POST',
				body: formData,
			});

			console.log('Response status:', response.status);

			let result;
			try {
				result = await response.json();
			} catch (e) {
				console.error('Failed to parse response as JSON:', e);
				throw new Error('Invalid response from server');
			}

			if (!response.ok) {
				throw new Error(result.message || 'Failed to upload caption');
			}

			toast.success('Caption uploaded successfully!');
			setCaptions([
				...captions,
				{ label: captionLabel, srclang: languageCode },
			]); // Add new caption to the table
		} catch (error) {
			console.error('Error uploading caption:', error);
			toast.error(
				error instanceof Error ? error.message : 'Error uploading caption',
			);
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteRequest = (srclang: string) => {
		setCaptionToDelete(srclang);
		setIsDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = async () => {
		if (captionToDelete) {
			try {
				const response = await fetch(
					`/api/videos/${videoId}/captions?srclang=${captionToDelete}`,
					{
						method: 'DELETE',
					},
				);

				if (!response.ok) {
					throw new Error('Failed to delete caption');
				}

				setCaptions(
					captions.filter((caption) => caption.srclang !== captionToDelete),
				);
				toast.success('Caption deleted successfully!');
			} catch (error) {
				console.error('Error deleting caption:', error);
				toast.error(
					error instanceof Error ? error.message : 'Error deleting caption',
				);
			} finally {
				setIsDeleteDialogOpen(false);
			}
		}
	};

	return (
		<Card className="col-span-4 w-full">
			<CardHeader>
				<CardTitle>Edit Captions</CardTitle>
				<CardDescription>Upload caption files to the video.</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleUpload();
					}}
				>
					<div className="flex flex-col space-y-4">
						<div className="space-y-2">
							<Label htmlFor="caption">Upload Caption File</Label>
							<CardDescription className="text-xs">
								Caption files must be .srt or .vtt format.
							</CardDescription>
							<Input
								id="caption"
								className="file:bg-primary file:text-primary-foreground border-0 bg-transparent shadow-none file:rounded-sm file:px-4"
								type="file"
								accept=".vtt,.srt"
								onChange={handleFileChange}
							/>
						</div>
						<div className="flex flex-row justify-between gap-x-2">
							<div className="space-y-2">
								<Label htmlFor="label">Caption Label</Label>
								<Input
									id="label"
									type="text"
									placeholder="Caption Language"
									value={captionLabel}
									onChange={(e) => setCaptionLabel(e.target.value)}
								/>
								<CardDescription className="text-xs">
									Specify the language of the caption.
								</CardDescription>
							</div>
							<div className="space-y-2">
								<Label htmlFor="srclang">Language Short Code</Label>
								<Input
									id="srclang"
									type="text"
									className="w-fit"
									placeholder="Language Code"
									value={languageCode}
									onChange={(e) => setLanguageCode(e.target.value)}
								/>
								<CardDescription className="text-xs">
									For example use "en" for English, "es" for Spanish, etc.
								</CardDescription>
							</div>
						</div>
					</div>
				</form>
			</CardContent>
			<CardFooter className="flex justify-between">
				<Button onClick={handleUpload} disabled={loading || !file}>
					<Upload className="size-4" />
					{loading ? 'Uploading...' : 'Upload Caption'}
				</Button>
			</CardFooter>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Caption Label</TableHead>
							<TableHead>Language Code</TableHead>
							<TableHead className="text-right">Delete Caption</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{captions.map((caption, index) => (
							<TableRow key={index}>
								<TableCell>{caption.label}</TableCell>
								<TableCell>{caption.srclang}</TableCell>
								<TableCell className="text-right">
									<Button
										onClick={() => handleDeleteRequest(caption.srclang)}
										variant="destructive"
									>
										<Trash2 className="size-4" />
										<span className="sr-only">Delete</span>
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
			<DeleteCaption
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
				onConfirm={handleDeleteConfirm}
			/>
		</Card>
	);
};

export default CaptionUpload;
