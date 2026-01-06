import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Upload } from 'lucide-react';
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { trpc } from '@/lib/trpc';
import DeleteCaption from './CaptionDelete';

interface CaptionUploadProps {
	videoId: string;
	libraryId?: string;
	initialCaptions: { label: string; srclang: string }[];
}

const CaptionUpload: React.FC<CaptionUploadProps> = ({
	videoId,
	libraryId,
	initialCaptions,
}) => {
	const queryClient = useQueryClient();
	const [file, setFile] = useState<File | null>(null);
	const [captionLabel, setCaptionLabel] = useState<string>('');
	const [languageCode, setLanguageCode] = useState<string>('');
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

	// Add caption mutation using tRPC
	const addCaptionMutation = useMutation({
		mutationFn: async (formData: {
			file: File;
			label: string;
			language: string;
		}) => {
			// Note: tRPC might not support file uploads directly
			// For now, we'll implement this as a two-step process:
			// 1. Upload the file via multipart form
			// 2. Create the track via tRPC
			const data = new FormData();
			data.append('file', formData.file);

			// This would be replaced with actual file upload implementation
			return trpc.mux.addCaption.mutate({
				assetId: videoId,
				libraryId,
				name: formData.label,
				language: formData.language,
				textType: 'subtitles',
			});
		},
		onSuccess: () => {
			toast.success('Caption uploaded successfully!');
			setCaptions([
				...captions,
				{
					label: captionLabel,
					srclang: languageCode,
				},
			]);
			setFile(null);
			setCaptionLabel('');
			setLanguageCode('');
			queryClient.invalidateQueries({
				queryKey: [['mux', 'getAsset']],
			});
		},
		onError: (error) => {
			console.error('Error uploading caption:', error);
			toast.error(
				error instanceof Error ? error.message : 'Error uploading caption',
			);
		},
	});

	// Delete caption mutation using tRPC
	const deleteCaptionMutation = useMutation({
		mutationFn: (trackId: string) =>
			trpc.mux.deleteCaption.mutate({
				assetId: videoId,
				libraryId,
				trackId,
			}),
		onSuccess: () => {
			if (captionToDelete) {
				setCaptions(
					captions.filter((caption) => caption.srclang !== captionToDelete),
				);
				toast.success('Caption deleted successfully!');
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getAsset']],
				});
			}
			setIsDeleteDialogOpen(false);
			setCaptionToDelete(null);
		},
		onError: (error) => {
			console.error('Error deleting caption:', error);
			toast.error(
				error instanceof Error ? error.message : 'Error deleting caption',
			);
		},
	});

	const handleUpload = async (e: React.FormEvent) => {
		e.preventDefault();
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

		addCaptionMutation.mutate({
			file,
			label: captionLabel,
			language: languageCode,
		});
	};

	const handleDeleteRequest = (srclang: string) => {
		setCaptionToDelete(srclang);
		setIsDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = async () => {
		if (captionToDelete) {
			deleteCaptionMutation.mutate(captionToDelete);
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
				<Button
					onClick={(e) => handleUpload(e as React.FormEvent<HTMLButtonElement>)}
					disabled={addCaptionMutation.isPending || !file}
				>
					<Upload className="size-4" />
					{addCaptionMutation.isPending ? 'Uploading...' : 'Upload Caption'}
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
						{captions.map((caption) => (
							<TableRow key={caption.srclang}>
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
