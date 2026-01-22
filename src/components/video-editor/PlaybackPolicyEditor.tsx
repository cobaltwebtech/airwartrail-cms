import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Globe, Loader2, Lock, Save } from 'lucide-react';
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc';

interface PlaybackPolicyEditorProps {
	videoId: string;
	libraryId: string;
	initialPolicy?: 'public' | 'signed';
}

const PlaybackPolicyEditor: React.FC<PlaybackPolicyEditorProps> = ({
	videoId,
	libraryId,
	initialPolicy = 'public',
}) => {
	const queryClient = useQueryClient();
	const [selectedPolicy, setSelectedPolicy] = useState<'public' | 'signed'>(
		initialPolicy,
	);

	const hasChanges = selectedPolicy !== initialPolicy;

	const updatePolicyMutation = useMutation(
		trpc.mux.updatePlaybackPolicy.mutationOptions({
			onSuccess: () => {
				toast.success('Playback policy updated successfully');
				// Invalidate queries to refresh video data
				queryClient.invalidateQueries({
					queryKey: [['mux', 'getVideoById']],
				});
				queryClient.invalidateQueries({
					queryKey: [['mux', 'listVideosFromDatabase']],
				});
			},
			onError: (err) => {
				// Revert the switch on error
				setSelectedPolicy(initialPolicy);
				const errorMessage =
					err instanceof Error ? err.message : 'Unknown error';
				toast.error('Failed to update playback policy');
				console.error('Update playback policy error:', errorMessage);
			},
		}),
	);

	const handleSave = () => {
		updatePolicyMutation.mutate({
			videoId,
			libraryId,
			playbackPolicy: selectedPolicy,
		});
	};

	return (
		<Card className="col-span-3">
			<CardHeader>
				<CardTitle>Playback Policy</CardTitle>
				<CardDescription>
					Set the playback policy for this video. Choose between Public or
					Signed.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="rounded-lg bg-muted p-4 space-y-2">
					<div className="flex items-start gap-3">
						<Globe className="size-5 text-muted-foreground shrink-0 mt-0.5" />
						<div className="space-y-1">
							<p className="font-medium text-sm">Public Access</p>
							<p className="text-xs text-muted-foreground">
								Anyone with the playback URL can watch this video. No
								authentication required. Best for content you want to share
								publicly or want to embed on websites without restrictions.
							</p>
						</div>
					</div>
					<hr />
					<div className="flex items-start gap-3">
						<Lock className="size-5 text-muted-foreground shrink-0 mt-0.5" />
						<div className="space-y-1">
							<p className="font-medium text-sm">Signed Access</p>
							<p className="text-xs text-muted-foreground">
								Video playback requires a valid signed token to play. Tokens
								expire after a set time. Use this policy for restricted or
								premium content that you only want to play for authorized or
								subscribed viewers.
							</p>
						</div>
					</div>
				</div>
				<Select
					value={selectedPolicy}
					onValueChange={(value) =>
						setSelectedPolicy(value as 'public' | 'signed')
					}
					disabled={updatePolicyMutation.isPending}
				>
					<SelectTrigger className="w-1/2">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="public">
							<div className="flex items-center gap-2">
								<Globe className="size-4" />
								Public
							</div>
						</SelectItem>
						<SelectItem value="signed">
							<div className="flex items-center gap-2">
								<Lock className="size-4" />
								Signed
							</div>
						</SelectItem>
					</SelectContent>
				</Select>
			</CardContent>
			<CardFooter className="flex justify-end">
				<Button
					onClick={handleSave}
					disabled={updatePolicyMutation.isPending || !hasChanges}
				>
					{updatePolicyMutation.isPending ? (
						<Loader2 className="mr-2 size-4 animate-spin" />
					) : (
						<Save className="mr-2 size-4" />
					)}
					Save Policy
				</Button>
			</CardFooter>
		</Card>
	);
};

export default PlaybackPolicyEditor;
