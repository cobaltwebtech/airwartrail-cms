import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface ConfirmDeleteDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => Promise<void>;
}

export function VideoDelete({
	open,
	onOpenChange,
	onConfirm,
}: ConfirmDeleteDialogProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [confirmText, setConfirmText] = useState('');

	const handleConfirm = async () => {
		setIsLoading(true);
		try {
			await onConfirm();
		} finally {
			setIsLoading(false);
			setConfirmText('');
			onOpenChange(false); // Close the dialog after the operation
		}
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			setConfirmText('');
		}
		onOpenChange(open);
	};

	const isDeleteEnabled = confirmText === 'DELETE' && !isLoading;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Confirm Deletion</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete this video? This action cannot be
						undone and the video will be permanently deleted. Any permalink to
						the video will no longer work.
					</DialogDescription>
				</DialogHeader>
				<div className="py-4">
					<p className="text-sm text-muted-foreground mb-2">
						Type <span className="font-semibold">DELETE</span> in uppercase to
						confirm:
					</p>
					<Input
						value={confirmText}
						onChange={(e) => setConfirmText(e.target.value)}
						placeholder="Type DELETE"
						disabled={isLoading}
						autoComplete="off"
					/>
				</div>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="secondary" disabled={isLoading}>
							Cancel
						</Button>
					</DialogClose>
					<Button
						variant="destructive"
						onClick={handleConfirm}
						disabled={!isDeleteEnabled}
					>
						{isLoading ? (
							<LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
						) : (
							'Delete'
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
