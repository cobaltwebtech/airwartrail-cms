import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CirclePlus } from 'lucide-react';
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
	DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';

export default function CollectionCreate() {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState('');

	const createCollectionMutation = useMutation(
		trpc.bunny.createCollection.mutationOptions({
			onSuccess: () => {
				toast.success('New collection created successfully');
				queryClient.invalidateQueries({
					queryKey: [['bunny', 'getCollections']],
				});
				setOpen(false);
				setName('');
			},
			onError: (error) => {
				toast.error(error.message || 'Failed to create collection');
			},
		}),
	);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		createCollectionMutation.mutate({ name });
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button>
					<CirclePlus />
					Create Collection
				</Button>
			</DialogTrigger>
			<DialogContent>
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Create New Collection</DialogTitle>
						<DialogDescription>
							Enter the name of the new collection.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<label htmlFor="name">Name</label>
							<Input
								id="name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Enter collection name"
								required
							/>
						</div>
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button
								variant="secondary"
								disabled={createCollectionMutation.isPending}
							>
								Cancel
							</Button>
						</DialogClose>
						<Button type="submit" disabled={createCollectionMutation.isPending}>
							{createCollectionMutation.isPending ? 'Creating...' : 'Create'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
