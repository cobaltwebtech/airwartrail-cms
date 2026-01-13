import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
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
import { trpc } from '@/lib/trpc';

type ApiKey = {
	id: string;
	name: string | null;
	start?: string | null;
	prefix?: string | null;
};

interface ApiKeyDeleteProps {
	apiKey: ApiKey | null;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onDeleted?: () => void;
}

export function ApiKeyDelete({
	apiKey,
	isOpen,
	onOpenChange,
	onDeleted,
}: ApiKeyDeleteProps) {
	const queryClient = useQueryClient();
	const [confirmText, setConfirmText] = useState('');

	const deleteMutation = useMutation(
		trpc.apiKeys.delete.mutationOptions({
			onSuccess: () => {
				toast.success('API key deleted successfully');
				queryClient.invalidateQueries({
					queryKey: trpc.apiKeys.list.queryKey(),
				});
				onOpenChange(false);
				onDeleted?.();
			},
			onError: (error) => {
				toast.error(`Failed to delete API key: ${error.message}`);
			},
		}),
	);

	const handleConfirm = () => {
		if (!apiKey) return;
		deleteMutation.mutate({ keyId: apiKey.id });
	};

	const handleOpenChange = (open: boolean) => {
		setConfirmText('');
		onOpenChange(open);
	};

	const isDeleteEnabled = confirmText === 'DELETE' && !deleteMutation.isPending;

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete API Key</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete{' '}
						<span className="font-semibold">
							{apiKey?.name || 'this API key'}
						</span>
						? This action cannot be undone. Any applications using this key will
						lose access immediately.
					</DialogDescription>
				</DialogHeader>
				{apiKey?.prefix && apiKey?.start && (
					<div className="py-2">
						<p className="text-sm">
							API Key:{' '}
							<code className="bg-secondary px-2 py-1 rounded-md text-sm w-fit">
								{apiKey.start}****
							</code>
						</p>
					</div>
				)}
				<div className="py-4">
					<p className="text-sm text-muted-foreground mb-2">
						Type <span className="font-semibold">DELETE</span> in uppercase to
						confirm:
					</p>
					<Input
						value={confirmText}
						onChange={(e) => setConfirmText(e.target.value)}
						placeholder="Type DELETE"
						disabled={deleteMutation.isPending}
						autoComplete="off"
					/>
				</div>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="secondary" disabled={deleteMutation.isPending}>
							Cancel
						</Button>
					</DialogClose>
					<Button
						variant="destructive"
						onClick={handleConfirm}
						disabled={!isDeleteEnabled}
					>
						{deleteMutation.isPending ? (
							<Loader2 className="animate-spin" />
						) : null}
						Delete API Key
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
