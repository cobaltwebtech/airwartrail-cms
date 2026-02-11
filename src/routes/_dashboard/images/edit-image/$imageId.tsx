import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	createFileRoute,
	useNavigate,
	useParams,
} from '@tanstack/react-router';
import { GlobeLock, LoaderCircle, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { ImageDelete } from '@/components/images/ImageDelete';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_dashboard/images/edit-image/$imageId')({
	component: ImageEditorPage,
});

function ImageEditorPage() {
	const { imageId } = useParams({
		from: '/_dashboard/images/edit-image/$imageId',
	});
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [formData, setFormData] = useState({
		fileName: '',
		altText: '',
		requireSignedURLs: false,
	});
	const [isSaving, setIsSaving] = useState(false);

	// Fetch image data
	const { data: image, isLoading: isLoadingImage } = useQuery({
		...trpc.cfImages.images.getImage.queryOptions({
			id: imageId,
		}),
	});

	// Update image mutation
	const updateImageMutation = useMutation(
		trpc.cfImages.images.updateImage.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'images', 'getImage']],
				});
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'images', 'listImages']],
				});
			},
		}),
	);

	// Delete image mutation
	const deleteImageMutation = useMutation(
		trpc.cfImages.images.deleteImage.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: [['cfImages', 'images', 'listImages']],
				});
				navigate({ to: '/images' });
			},
		}),
	);

	// Initialize form when image data loads
	useEffect(() => {
		if (image) {
			setFormData({
				fileName: image.fileName || '',
				altText: image.altText || '',
				requireSignedURLs: image.requireSignedURLs || false,
			});
		}
	}, [image]);

	const handleSave = async () => {
		setIsSaving(true);
		try {
			await updateImageMutation.mutateAsync({
				id: imageId,
				fileName: formData.fileName || null,
				altText: formData.altText || null,
				requireSignedURLs: formData.requireSignedURLs,
			});
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async () => {
		await deleteImageMutation.mutateAsync({
			id: imageId,
			deleteFromCf: true,
		});
	};

	if (isLoadingImage) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<LoaderCircle className="h-8 w-8 animate-spin" />
			</div>
		);
	}

	if (!image) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen gap-4">
				<p className="text-destructive">Image not found</p>
				<Button onClick={() => navigate({ to: '/images' })}>
					Back to Images
				</Button>
			</div>
		);
	}

	return (
		<>
			<DashboardHeader heading="Edit Image">
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink href="/images">
								&larr; Back to Images
							</BreadcrumbLink>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</DashboardHeader>

			<section className="my-8 grid md:grid-cols-2 gap-8">
				<Card>
					<CardHeader>
						<CardTitle>{image.fileName || 'N/A'}</CardTitle>
						<CardDescription>
							Update the image details and settings below. Remember to save your
							changes.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							{/* Image Title */}
							<Label htmlFor="fileName">Image Title</Label>
							<Input
								id="fileName"
								placeholder="Enter image title or filename"
								value={formData.fileName}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										fileName: e.target.value,
									}))
								}
								disabled={isSaving}
							/>
						</div>

						{/* Alt Text */}
						<div className="space-y-2">
							<Label htmlFor="altText">Alt Text</Label>
							<Input
								id="altText"
								placeholder="Enter alt text for accessibility"
								value={formData.altText}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										altText: e.target.value,
									}))
								}
								disabled={isSaving}
							/>
							<p className="text-xs text-muted-foreground">
								Describes the image for accessibility and SEO. It can also be
								used for short description.
							</p>
						</div>

						{/* Signed URLs Toggle */}
						<div className="flex items-center justify-between gap-4 rounded-lg border p-3">
							<div>
								<GlobeLock className="size-6" />
							</div>
							<div>
								<Label htmlFor="requireSignedURLs">Require Signed URLs</Label>
								<p className="text-xs text-muted-foreground mt-1">
									A signed URL for an image provides an extra layer of security
									by requring a valid signature with an expiration (usually one
									hour). If a user shares the image URL, it will only be
									accessible until the signature expires. Enable this if you
									want to protect access to the image.
								</p>
							</div>
							<Switch
								id="requireSignedURLs"
								checked={formData.requireSignedURLs}
								onCheckedChange={(checked) =>
									setFormData((prev) => ({
										...prev,
										requireSignedURLs: checked,
									}))
								}
								disabled={isSaving}
							/>
						</div>
					</CardContent>
					<CardFooter className="gap-4">
						<Button onClick={handleSave} disabled={isSaving} className="flex-1">
							{isSaving ? (
								<LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
							) : null}
							<Save />
							Save Changes
						</Button>
						<Button
							variant="destructive"
							onClick={() => setIsDeleteDialogOpen(true)}
							disabled={isSaving || deleteImageMutation.isPending}
						>
							<Trash2 />
							Delete Image
						</Button>
					</CardFooter>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Image Preview</CardTitle>
					</CardHeader>
					<CardContent>
						{/* Image Preview */}
						<div className="flex justify-center">
							<img
								src={`${image.deliveryUrl}/md`}
								alt={image.altText || 'Preview'}
								className="w-full object-cover"
							/>
						</div>
					</CardContent>
				</Card>
				<Card className="col-span-full">
					<CardHeader>
						<CardTitle>Internal Image Data</CardTitle>
					</CardHeader>
					<CardContent className="grid lg:grid-cols-2 gap-4 text-muted-foreground text-sm">
						<div className="space-y-1 text-xs">
							<p className="uppercase tracking-wide">Internal Image ID</p>
							<pre className="bg-secondary text-secondary-foreground px-2 py-1 rounded font-mono text-wrap w-fit">
								{image.id}
							</pre>
						</div>
						<div className="space-y-1 text-xs">
							<p className="uppercase tracking-wide">CF Image ID</p>
							<pre className="bg-secondary text-secondary-foreground px-2 py-1 rounded font-mono text-wrap w-fit">
								{image.cfImageId}
							</pre>
						</div>
						<div className="space-y-1 text-xs">
							<p className="uppercase tracking-wide">Dimensions</p>
							<pre className="bg-secondary text-secondary-foreground px-2 py-1 rounded font-mono text-wrap w-fit">
								{image.width}x{image.height}
							</pre>
						</div>
						<div className="space-y-1 text-xs">
							<p className="uppercase tracking-wide">Created At</p>
							<pre className="bg-secondary text-secondary-foreground px-2 py-1 rounded font-mono text-wrap w-fit">
								{new Date(image.createdAt).toLocaleString()}
							</pre>
						</div>
					</CardContent>
				</Card>
			</section>

			{/* Delete Dialog */}
			<ImageDelete
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
				onConfirm={handleDelete}
				imageName={image.fileName ?? undefined}
			/>
		</>
	);
}
