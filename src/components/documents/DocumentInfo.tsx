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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';

interface DocumentInfoProps {
	documentId: string;
	documentName: string;
	currentDescription: string | null;
	onClose: () => void;
	onSuccess: () => void;
}

export function DocumentInfo({
	documentId,
	documentName,
	currentDescription,
	onClose,
	onSuccess,
}: DocumentInfoProps) {
	const [name, setName] = useState(documentName);
	const [description, setDescription] = useState(currentDescription || '');
	const [isLoading, setIsLoading] = useState(false);

	const updateMutation = useMutation(
		trpc.documents.update.mutationOptions({
			onSuccess: () => {
				toast.success('Document updated');
				onSuccess();
			},
			onError: (error) => {
				toast.error(`Failed to update document: ${error.message}`);
			},
		}),
	);

	const handleSave = async () => {
		if (!name.trim()) {
			toast.error('Name is required');
			return;
		}

		setIsLoading(true);
		try {
			await updateMutation.mutateAsync({
				id: documentId,
				name: name.trim(),
				description: description || null,
			});
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Dialog open={true} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit File Info</DialogTitle>
					<DialogDescription>
						Update the name and description for this document
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="name">Name</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Document name"
							maxLength={255}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Enter a description for this document..."
							className="min-h-[100px]"
							maxLength={1000}
						/>
						<p className="text-xs text-muted-foreground">
							{description.length}/1000 characters
						</p>
					</div>
				</div>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="secondary" disabled={isLoading}>
							Cancel
						</Button>
					</DialogClose>
					<Button onClick={handleSave} disabled={isLoading}>
						{isLoading ? (
							<LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
						) : null}
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
