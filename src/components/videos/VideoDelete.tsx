import { useState } from 'react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
	DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoaderCircle } from 'lucide-react';

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

	const handleConfirm = async () => {
		setIsLoading(true);
		try {
			await onConfirm();
		} finally {
			setIsLoading(false);
			onOpenChange(false); // Close the dialog after the operation
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Confirm Deletion</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete this video? This action cannot be
						undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="secondary" disabled={isLoading}>
							Cancel
						</Button>
					</DialogClose>
					<Button
						variant="destructive"
						onClick={handleConfirm}
						disabled={isLoading}
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
