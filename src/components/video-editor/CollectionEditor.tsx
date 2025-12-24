import React, { useState, useEffect } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectGroup,
	SelectLabel,
	SelectContent,
	SelectItem,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface CollectionEditorProps {
	collectionId: string;
	onUpdateCollectionId: (newCollectionId: string | null) => void;
	collections: { guid: string; name: string }[];
	videoId: string;
}

const CollectionEditor: React.FC<CollectionEditorProps> = ({
	collectionId,
	onUpdateCollectionId,
	collections,
	videoId,
}) => {
	const [selectedCollectionId, setSelectedCollectionId] = useState<
		string | null
	>(collectionId);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [currentCollectionName, setCurrentCollectionName] = useState('');

	useEffect(() => {
		const currentCollection = collections.find(
			(collection) => collection.guid === collectionId,
		);
		setCurrentCollectionName(
			currentCollection ? currentCollection.name : 'None selected',
		);
	}, [collectionId, collections]);

	const handleSave = async () => {
		if (selectedCollectionId !== collectionId) {
			await updateVideoCollection(videoId, selectedCollectionId);
		}
		onUpdateCollectionId(selectedCollectionId);
		setDialogOpen(false);
	};

	const handleRemoveFromCollection = async () => {
		setSelectedCollectionId('');
		await updateVideoCollection(videoId, '');
		onUpdateCollectionId('');
		setDialogOpen(false);
	};

	const handleDialogChange = (isOpen: boolean) => {
		setDialogOpen(isOpen);
	};

	const updateVideoCollection = async (
		videoId: string,
		newCollection: string | null,
	) => {
		try {
			const response = await fetch('/api/videos/[videoId]/collectionUpdate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ videoId, newCollection }),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Failed to update video collection: ${errorText}`);
			}

			toast.success('Collection updated on video successfully');
		} catch (error) {
			console.error('Error updating video collection:', error);
			toast.error('Failed to update video collection');
		}
	};

	return (
		<Card className="col-span-2 w-full justify-between">
			<CardHeader className="space-y-2">
				<CardTitle>Edit Collection</CardTitle>

				<p className="text-sm">Current Collection</p>
				<p className="text-accent text-lg font-semibold">
					{currentCollectionName}
				</p>
			</CardHeader>
			<CardContent>
				<Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
					<DialogTrigger asChild>
						<div className="">
							<Button onClick={() => setDialogOpen(true)}>
								<Pencil className="size-4" />
								Update Collection
							</Button>
						</div>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Update Collection</DialogTitle>
							<DialogDescription>
								Select or remove a collection for the video.
							</DialogDescription>
							<DialogDescription>
								If a collection does not exist you will need to create it first
								by going to the{' '}
								<a
									href="/collections"
									className="text-accent-foreground hover:text-accent font-bold underline"
								>
									Collections
								</a>{' '}
								page.
							</DialogDescription>
						</DialogHeader>
						<Select
							value={selectedCollectionId ?? ''}
							onValueChange={(value) => setSelectedCollectionId(value)}
						>
							<SelectTrigger className="w-[180px]">
								<SelectValue placeholder="Select option" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectLabel>Collections List</SelectLabel>
									{collections.map((collection) => (
										<SelectItem key={collection.guid} value={collection.guid}>
											{collection.name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
						<DialogFooter className="flex flex-row sm:justify-between">
							<div>
								<Button
									variant="destructive"
									onClick={handleRemoveFromCollection}
								>
									Remove from Collection
								</Button>
							</div>
							<div className="space-x-4">
								<Button
									variant="secondary"
									onClick={() => setDialogOpen(false)}
								>
									Cancel
								</Button>
								<Button onClick={handleSave}>Save</Button>
							</div>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</CardContent>
		</Card>
	);
};

export default CollectionEditor;
