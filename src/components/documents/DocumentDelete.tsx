import { useMutation } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { trpc } from '@/lib/trpc';

interface DocumentDeleteProps {
	documentId: string;
	onClose: () => void;
	onSuccess: () => void;
}

export function DocumentDelete({
	documentId,
	onClose,
	onSuccess,
}: DocumentDeleteProps) {
	const [isLoading, setIsLoading] = useState(false);

	const deleteMutation = useMutation(
		trpc.documents.delete.mutationOptions({
			onSuccess: () => {
				toast.success('Document deleted successfully');
				onSuccess();
			},
			onError: (error) => {
				toast.error(`Failed to delete document: ${error.message}`);
				onClose();
			},
		}),
	);

	const handleConfirm = async () => {
		setIsLoading(true);
		try {
			await deleteMutation.mutateAsync({ id: documentId });
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Dialog open={true} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Confirm Deletion</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete this document? This action cannot be
						undone and the document will be permanently deleted from storage.
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
