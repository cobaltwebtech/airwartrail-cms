import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { trpc } from '@/lib/trpc';
import type { Playlist } from './PlaylistList';

interface PlaylistDeleteProps {
	playlist: Playlist | null;
	libraryId: string;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export function PlaylistDelete({
	playlist,
	libraryId,
	isOpen,
	onOpenChange,
}: PlaylistDeleteProps) {
	const queryClient = useQueryClient();
	const [confirmText, setConfirmText] = useState('');

	const deleteMutation = useMutation(
		trpc.mux.deletePlaylist.mutationOptions({
			onSuccess: () => {
				toast.success('Playlist deleted successfully');
				queryClient.invalidateQueries({
					queryKey: trpc.mux.listPlaylists.queryKey({ libraryId }),
				});
				onOpenChange(false);
			},
			onError: (error) => {
				toast.error(`Failed to delete playlist: ${error.message}`);
			},
		}),
	);

	const handleConfirm = () => {
		if (!playlist) return;
		deleteMutation.mutate({
			playlistId: playlist.id,
			libraryId,
		});
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			setConfirmText('');
		}
		onOpenChange(open);
	};

	const isDeleteEnabled = confirmText === 'DELETE' && !deleteMutation.isPending;

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete Playlist</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete{' '}
						<span className="font-semibold">{playlist?.name}</span>? This action
						cannot be undone. The videos in this playlist will not be deleted,
						only the playlist itself.
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
							<LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
						) : (
							'Delete Playlist'
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
