import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '@/components/ui/dialog';

interface R2File {
	name: string;
	size: number;
	path: string;
}

interface FileDeleteProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	fileToDelete: R2File | null;
	filesToDelete?: string[];
	onConfirm: () => Promise<void>;
	onConfirmMultiple?: (paths: string[]) => Promise<void>;
	formatFileSize: (bytes: number) => string;
}

export function FileDelete({
	isOpen,
	onOpenChange,
	fileToDelete,
	filesToDelete,
	onConfirm,
	onConfirmMultiple,
	formatFileSize,
}: FileDeleteProps) {
	const isBulkDelete = filesToDelete && filesToDelete.length > 0;

	const handleConfirm = async () => {
		if (isBulkDelete && onConfirmMultiple) {
			await onConfirmMultiple(filesToDelete);
		} else if (fileToDelete && onConfirm) {
			await onConfirm();
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{isBulkDelete ? 'Delete Multiple Files' : 'Delete File'}
					</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete{' '}
						{isBulkDelete ? 'these files' : 'this file'}? This action cannot be
						undone.
					</DialogDescription>
				</DialogHeader>

				{fileToDelete && !isBulkDelete && (
					<div className="bg-secondary rounded-md p-3">
						<p className="font-medium">{fileToDelete.name}</p>
						<p className="text-muted-foreground text-sm">
							{formatFileSize(fileToDelete.size)}
						</p>
					</div>
				)}

				{isBulkDelete && (
					<div className="bg-secondary rounded-md p-3">
						<p className="font-medium">{filesToDelete.length} files selected</p>
					</div>
				)}

				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
					<Button variant="destructive" onClick={handleConfirm}>
						Delete
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
