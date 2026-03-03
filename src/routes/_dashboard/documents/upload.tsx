import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
	AlertCircle,
	ArrowLeft,
	CheckCircle,
	FileText,
	Loader2,
	Upload,
	X,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
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
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_dashboard/documents/upload')({
	component: DocumentUploadPage,
});

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const SUPPORTED_MIME_TYPES = [
	'application/pdf',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'text/plain',
	'text/markdown',
	'application/rtf',
	'text/csv',
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/vnd.ms-powerpoint',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

const SUPPORTED_EXTENSIONS = [
	'pdf',
	'doc',
	'docx',
	'txt',
	'md',
	'markdown',
	'rtf',
	'csv',
	'xls',
	'xlsx',
	'ppt',
	'pptx',
] as const;

interface FileWithPreview {
	file: File;
	id: string;
	status: 'pending' | 'uploading' | 'success' | 'error';
	error?: string;
	progress: number;
	name: string;
	description: string;
}

function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

function validateFile(file: File): { valid: boolean; error?: string } {
	const ext = file.name.split('.').pop()?.toLowerCase();

	if (
		!ext ||
		!SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number])
	) {
		return {
			valid: false,
			error: `Unsupported file type. Allowed: ${SUPPORTED_EXTENSIONS.join(', ')}`,
		};
	}

	if (file.size > MAX_FILE_SIZE) {
		return {
			valid: false,
			error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
		};
	}

	const validMimeType = SUPPORTED_MIME_TYPES.includes(
		file.type as (typeof SUPPORTED_MIME_TYPES)[number],
	);
	if (!validMimeType && ext) {
		const mimeTypeMap: Record<string, string> = {
			pdf: 'application/pdf',
			doc: 'application/msword',
			docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			txt: 'text/plain',
			md: 'text/markdown',
			markdown: 'text/markdown',
			rtf: 'application/rtf',
			csv: 'text/csv',
			xls: 'application/vnd.ms-excel',
			xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			ppt: 'application/vnd.ms-powerpoint',
			pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			json: 'application/json',
			xml: 'text/xml',
		};

		if (!mimeTypeMap[ext]) {
			return {
				valid: false,
				error: `Could not determine file type for .${ext}`,
			};
		}
	}

	return { valid: true };
}

function generateId(): string {
	return Math.random().toString(36).substring(2, 9);
}

function DocumentUploadPage() {
	const [files, setFiles] = useState<FileWithPreview[]>([]);
	const [dragActive, setDragActive] = useState(false);
	const queryClient = useQueryClient();

	const uploadMutation = useMutation(
		trpc.documents.create.mutationOptions({
			onSuccess: (data, input) => {
				setFiles((prev) =>
					prev.map((f) =>
						f.file.name === input.fileName
							? { ...f, status: 'success', progress: 100 }
							: f,
					),
				);
				toast.success(`"${data.name}" uploaded successfully`);
			},
			onError: (error, input) => {
				setFiles((prev) =>
					prev.map((f) =>
						f.file.name === input.fileName
							? { ...f, status: 'error', error: error.message }
							: f,
					),
				);
				toast.error(`Failed to upload "${input.fileName}": ${error.message}`);
			},
		}),
	);

	const handleDrag = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.type === 'dragenter' || e.type === 'dragover') {
			setDragActive(true);
		} else if (e.type === 'dragleave') {
			setDragActive(false);
		}
	}, []);

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);

		if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			const newFiles: FileWithPreview[] = [];
			for (let i = 0; i < e.dataTransfer.files.length; i++) {
				const file = e.dataTransfer.files[i];
				const validation = validateFile(file);
				newFiles.push({
					file,
					id: generateId(),
					status: validation.valid ? 'pending' : 'error',
					error: validation.error,
					progress: 0,
					name: file.name.replace(/\.[^/.]+$/, ''),
					description: '',
				});
			}
			setFiles((prev) => [...prev, ...newFiles]);
		}
	}, []);

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			if (e.target.files && e.target.files.length > 0) {
				const newFiles: FileWithPreview[] = [];
				for (let i = 0; i < e.target.files.length; i++) {
					const file = e.target.files[i];
					const validation = validateFile(file);
					newFiles.push({
						file,
						id: generateId(),
						status: validation.valid ? 'pending' : 'error',
						error: validation.error,
						progress: 0,
						name: file.name.replace(/\.[^/.]+$/, ''),
						description: '',
					});
				}
				setFiles((prev) => [...prev, ...newFiles]);
			}
		},
		[],
	);

	const handleRemoveFile = (id: string) => {
		setFiles((prev) => prev.filter((f) => f.id !== id));
	};

	const handleNameChange = (id: string, name: string) => {
		setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
	};

	const handleDescriptionChange = (id: string, description: string) => {
		setFiles((prev) =>
			prev.map((f) => (f.id === id ? { ...f, description } : f)),
		);
	};

	const handleUploadAll = async () => {
		const pendingFiles = files.filter((f) => f.status === 'pending');

		for (const fileObj of pendingFiles) {
			setFiles((prev) =>
				prev.map((f) =>
					f.id === fileObj.id ? { ...f, status: 'uploading', progress: 50 } : f,
				),
			);

			try {
				const arrayBuffer = await fileObj.file.arrayBuffer();
				const base64 = btoa(
					new Uint8Array(arrayBuffer).reduce(
						(data, byte) => data + String.fromCharCode(byte),
						'',
					),
				);

				const ext = fileObj.file.name.split('.').pop()?.toLowerCase();
				const mimeTypeMap: Record<string, string> = {
					pdf: 'application/pdf',
					doc: 'application/msword',
					docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
					txt: 'text/plain',
					md: 'text/markdown',
					markdown: 'text/markdown',
					rtf: 'application/rtf',
					csv: 'text/csv',
					xls: 'application/vnd.ms-excel',
					xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
					ppt: 'application/vnd.ms-powerpoint',
					pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
				};

				const mimeType =
					fileObj.file.type ||
					mimeTypeMap[ext || ''] ||
					'application/octet-stream';

				await uploadMutation.mutateAsync({
					name: fileObj.name || fileObj.file.name,
					description: fileObj.description || undefined,
					mimeType: mimeType as (typeof SUPPORTED_MIME_TYPES)[number],
					fileSize: fileObj.file.size,
					fileName: fileObj.file.name,
					fileData: base64,
				});

				queryClient.invalidateQueries({ queryKey: [['documents', 'list']] });
			} catch {
				// Error handled by mutation
			}
		}
	};

	const pendingCount = files.filter((f) => f.status === 'pending').length;
	const uploadingCount = files.filter((f) => f.status === 'uploading').length;
	const successCount = files.filter((f) => f.status === 'success').length;
	const errorCount = files.filter((f) => f.status === 'error').length;

	return (
		<>
			<Breadcrumb className="mb-6">
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink href="/documents">Documents</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>Upload</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<DashboardHeader
				heading="Upload Documents"
				text="Upload documents to your library"
			>
				<div className="flex justify-end">
					<Button asChild>
						<Link to="/documents">
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back to Documents
						</Link>
					</Button>
				</div>
			</DashboardHeader>

			<Card>
				<CardHeader>
					<CardTitle>Upload Files</CardTitle>
					<CardDescription>
						Drag and drop files here or click to browse. Maximum file size is{' '}
						{MAX_FILE_SIZE / 1024 / 1024}MB.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2">
					<button
						type="button"
						className={`relative flex min-h-50 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
							dragActive
								? 'border-primary bg-primary/5'
								: 'border-muted-foreground/25'
						} ${files.length > 0 ? 'mb-4' : ''}`}
						onDragEnter={handleDrag}
						onDragLeave={handleDrag}
						onDragOver={handleDrag}
						onDrop={handleDrop}
					>
						<input
							type="file"
							multiple
							accept={SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(',')}
							onChange={handleFileSelect}
							className="absolute inset-0 cursor-pointer opacity-0"
						/>
						<Upload className="mb-4 h-10 w-10 text-muted-foreground" />
						<p className="text-sm text-muted-foreground">
							Drag and drop files here or click to browse
						</p>
						<p className="mt-2 text-xs text-muted-foreground">
							Supported: {SUPPORTED_EXTENSIONS.join(', ')}
						</p>
					</button>

					{files.length > 0 && (
						<div className="space-y-2">
							{files.map((fileObj) => (
								<div
									key={fileObj.id}
									className="flex items-center gap-2 rounded-md border p-2"
								>
									<FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<span className="truncate text-sm font-medium">
												{fileObj.file.name}
											</span>
											{fileObj.status === 'pending' && (
												<Badge variant="secondary">Pending</Badge>
											)}
											{fileObj.status === 'uploading' && (
												<Badge variant="default">
													<Loader2 className="mr-1 h-3 w-3 animate-spin" />
													Uploading
												</Badge>
											)}
											{fileObj.status === 'success' && (
												<Badge variant="default" className="bg-green-500">
													<CheckCircle className="mr-1 h-3 w-3" />
													Uploaded
												</Badge>
											)}
											{fileObj.status === 'error' && (
												<Badge variant="destructive">
													<AlertCircle className="mr-1 h-3 w-3" />
													Error
												</Badge>
											)}
										</div>
										<div className="text-xs text-muted-foreground">
											{formatFileSize(fileObj.file.size)}
										</div>
										{fileObj.error && (
											<Alert variant="destructive" className="mt-2 py-2">
												<AlertCircle className="h-4 w-4" />
												<AlertTitle>Error</AlertTitle>
												<AlertDescription className="text-xs">
													{fileObj.error}
												</AlertDescription>
											</Alert>
										)}
										{fileObj.status === 'uploading' && (
											<Progress value={fileObj.progress} className="mt-2 h-1" />
										)}
									</div>
									{fileObj.status !== 'uploading' && (
										<Button
											variant="ghost"
											size="icon"
											className="shrink-0"
											onClick={() => handleRemoveFile(fileObj.id)}
										>
											<X className="h-4 w-4" />
										</Button>
									)}
								</div>
							))}
						</div>
					)}

					{files.length > 0 && (
						<div className="mt-4 flex flex-wrap gap-2">
							{successCount > 0 && (
								<Badge variant="default" className="bg-green-500">
									{successCount} uploaded
								</Badge>
							)}
							{errorCount > 0 && (
								<Badge variant="destructive">{errorCount} failed</Badge>
							)}
							{uploadingCount > 0 && (
								<Badge variant="default">{uploadingCount} uploading</Badge>
							)}
						</div>
					)}

					<div>
						<p className="font-semibold">File Details</p>
						{files.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								Upload files first to add details
							</p>
						) : (
							<div className="space-y-4">
								{files
									.filter((f) => f.status !== 'success')
									.map((fileObj) => (
										<div key={fileObj.id} className="space-y-2">
											<Label htmlFor={`name-${fileObj.id}`}>
												{fileObj.file.name}
											</Label>
											<Input
												id={`name-${fileObj.id}`}
												placeholder="Document name"
												value={fileObj.name}
												onChange={(e) =>
													handleNameChange(fileObj.id, e.target.value)
												}
											/>
											<Input
												id={`desc-${fileObj.id}`}
												placeholder="Description (optional)"
												value={fileObj.description}
												onChange={(e) =>
													handleDescriptionChange(fileObj.id, e.target.value)
												}
											/>
										</div>
									))}
							</div>
						)}
					</div>
				</CardContent>
				<CardFooter>
					{pendingCount > 0 && (
						<Button
							className="mt-4 w-full"
							onClick={handleUploadAll}
							disabled={uploadMutation.isPending}
						>
							{uploadMutation.isPending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Uploading...
								</>
							) : (
								<>
									<Upload className="mr-2 h-4 w-4" />
									Upload {pendingCount} file{pendingCount !== 1 ? 's' : ''}
								</>
							)}
						</Button>
					)}
				</CardFooter>
			</Card>
		</>
	);
}
