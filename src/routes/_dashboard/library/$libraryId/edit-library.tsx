import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
	ArrowLeft,
	CheckCircle,
	KeyRound,
	Loader2,
	Save,
	Settings,
	Trash2,
	XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute(
	'/_dashboard/library/$libraryId/edit-library',
)({
	component: LibrarySettingsPage,
	loader: async ({ context: { queryClient }, params }) => {
		await queryClient.ensureQueryData(
			trpc.mux.getLibrary.queryOptions({ libraryId: params.libraryId }),
		);
		return { libraryId: params.libraryId };
	},
});

function LibrarySettingsPage() {
	const { libraryId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const {
		data: library,
		isLoading,
		error,
	} = useQuery(trpc.mux.getLibrary.queryOptions({ libraryId }));

	// Form state
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [muxEnvironmentId, setMuxEnvironmentId] = useState('');
	const [tokenId, setTokenId] = useState('');
	const [tokenSecret, setTokenSecret] = useState('');
	const [signingKeyId, setSigningKeyId] = useState('');
	const [signingKeyPrivate, setSigningKeyPrivate] = useState('');
	const [webhookSecret, setWebhookSecret] = useState('');
	const [defaultPlaybackPolicy, setDefaultPlaybackPolicy] = useState<
		'public' | 'signed' | 'drm'
	>('public');
	const [defaultVideoQuality, setDefaultVideoQuality] = useState<
		'basic' | 'plus' | 'premium'
	>('plus');
	const [isDefault, setIsDefault] = useState(false);
	const [isFormInitialized, setIsFormInitialized] = useState(false);

	// Initialize form when library data loads
	if (library && !isFormInitialized) {
		setName(library.name);
		setDescription(library.description || '');
		setMuxEnvironmentId(library.muxEnvironmentId || '');
		setTokenId(library.tokenId || '');
		setSigningKeyId(library.signingKeyId || '');
		setWebhookSecret(library.webhookSecret || '');
		setDefaultPlaybackPolicy(library.defaultPlaybackPolicy);
		setDefaultVideoQuality(library.defaultVideoQuality);
		setIsDefault(library.isDefault);
		setIsFormInitialized(true);
	}

	// Update mutation
	const updateMutation = useMutation(
		trpc.mux.updateLibrary.mutationOptions({
			onSuccess: () => {
				toast.success('Library settings saved');
				queryClient.invalidateQueries({
					queryKey: trpc.mux.getLibrary.queryKey({ libraryId }),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.mux.listLibraries.queryKey(),
				});
			},
			onError: (error) => {
				toast.error(`Failed to save: ${error.message}`);
			},
		}),
	);

	// Delete mutation
	const deleteMutation = useMutation(
		trpc.mux.deleteLibrary.mutationOptions({
			onSuccess: () => {
				toast.success('Library deleted');
				queryClient.invalidateQueries({
					queryKey: trpc.mux.listLibraries.queryKey(),
				});
				navigate({ to: '/' });
			},
			onError: (error) => {
				toast.error(`Failed to delete: ${error.message}`);
			},
		}),
	);

	// Test credentials mutation
	const testCredentialsMutation = useMutation(
		trpc.mux.testLibraryCredentials.mutationOptions({
			onSuccess: (result) => {
				if (result.success) {
					toast.success('Credentials are valid!');
				} else {
					toast.error(result.message);
				}
			},
			onError: (error) => {
				toast.error(`Test failed: ${error.message}`);
			},
		}),
	);

	const handleSave = () => {
		const updateData: Parameters<typeof updateMutation.mutate>[0] = {
			libraryId,
			name,
			description: description || null,
			defaultPlaybackPolicy,
			defaultVideoQuality,
			isDefault,
		};

		// Only include credentials if they were modified
		if (muxEnvironmentId !== undefined) {
			updateData.muxEnvironmentId = muxEnvironmentId || null;
		}
		if (tokenId) updateData.tokenId = tokenId;
		if (tokenSecret) updateData.tokenSecret = tokenSecret;
		if (signingKeyId) updateData.signingKeyId = signingKeyId;
		if (signingKeyPrivate) updateData.signingKeyPrivate = signingKeyPrivate;
		if (webhookSecret) updateData.webhookSecret = webhookSecret;

		updateMutation.mutate(updateData);
	};

	const handleTestCredentials = () => {
		if (!tokenId || !tokenSecret) {
			toast.error('Please enter both Token ID and Token Secret to test');
			return;
		}
		testCredentialsMutation.mutate({ tokenId, tokenSecret });
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-12">
				<Loader2 className="text-muted-foreground size-8 animate-spin" />
			</div>
		);
	}

	if (error || !library) {
		return (
			<div className="p-6">
				<div className="bg-destructive/10 text-destructive rounded-md p-4">
					Error loading library: {error?.message || 'Library not found'}
				</div>
				<Button variant="outline" className="mt-4" asChild>
					<Link to="/">
						<ArrowLeft className="mr-2 size-4" />
						Back to Libraries
					</Link>
				</Button>
			</div>
		);
	}

	return (
		<>
			<DashboardHeader
				heading={`${library.name} Settings`}
				text="Manage your video library configuration and Mux credentials."
			/>

			<div className="p-4 lg:p-6 space-y-6">
				<div className="flex items-center justify-between">
					<Link
						to="/"
						className="text-muted-foreground hover:text-primary inline-flex items-center text-sm transition-colors"
					>
						<ArrowLeft className="mr-2 size-4" />
						Back to Libraries
					</Link>

					<Dialog>
						<DialogTrigger asChild>
							<Button variant="destructive" size="sm">
								<Trash2 className="mr-2 size-4" />
								Delete Library
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Delete Library</DialogTitle>
								<DialogDescription>
									Are you sure you want to delete "{library.name}"? This action
									cannot be undone. All videos associated with this library will
									become inaccessible.
								</DialogDescription>
							</DialogHeader>
							<DialogFooter>
								<DialogClose asChild>
									<Button variant="outline">Cancel</Button>
								</DialogClose>
								<Button
									variant="destructive"
									onClick={() => deleteMutation.mutate({ libraryId })}
								>
									{deleteMutation.isPending ? (
										<Loader2 className="mr-2 size-4 animate-spin" />
									) : null}
									Delete
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>

				<div className="grid gap-6 lg:grid-cols-2">
					{/* General Settings */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Settings className="size-5" />
								General Settings
							</CardTitle>
							<CardDescription>
								Basic information about your video library.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="name">Library Name</Label>
								<Input
									id="name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="My Video Library"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="description">Description</Label>
								<Textarea
									id="description"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder="Optional description for this library..."
									rows={3}
								/>
							</div>

							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label htmlFor="isDefault">Default Library</Label>
									<p className="text-muted-foreground text-sm">
										Use this library by default when none is specified.
									</p>
								</div>
								<Switch
									id="isDefault"
									checked={isDefault}
									onCheckedChange={setIsDefault}
								/>
							</div>
						</CardContent>
					</Card>

					{/* Playback Settings */}
					<Card>
						<CardHeader>
							<CardTitle>Playback Settings</CardTitle>
							<CardDescription>
								Default settings for new videos uploaded to this library.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="playbackPolicy">Default Playback Policy</Label>
								<Select
									value={defaultPlaybackPolicy}
									onValueChange={(value) =>
										setDefaultPlaybackPolicy(
											value as 'public' | 'signed' | 'drm',
										)
									}
								>
									<SelectTrigger id="playbackPolicy">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="public">Public</SelectItem>
										<SelectItem value="signed">Signed</SelectItem>
										<SelectItem value="drm">DRM Protected</SelectItem>
									</SelectContent>
								</Select>
								<p className="text-muted-foreground text-xs">
									Public videos can be accessed by anyone. Signed videos require
									a token. DRM adds additional content protection.
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="videoQuality">Default Video Quality</Label>
								<Select
									value={defaultVideoQuality}
									onValueChange={(value) =>
										setDefaultVideoQuality(
											value as 'basic' | 'plus' | 'premium',
										)
									}
								>
									<SelectTrigger id="videoQuality">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="basic">Basic</SelectItem>
										<SelectItem value="plus">Plus</SelectItem>
										<SelectItem value="premium">Premium</SelectItem>
									</SelectContent>
								</Select>
								<p className="text-muted-foreground text-xs">
									Higher quality settings provide better encoding but cost more.
								</p>
							</div>
						</CardContent>
					</Card>

					{/* Mux Credentials */}
					<Card className="lg:col-span-2">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<KeyRound className="size-5" />
								Mux API Credentials
							</CardTitle>
							<CardDescription>
								Your Mux API credentials. Leave fields empty to keep existing
								values.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="space-y-2">
								<Label htmlFor="muxEnvironmentId">Mux Environment ID</Label>
								<Input
									id="muxEnvironmentId"
									value={muxEnvironmentId}
									onChange={(e) => setMuxEnvironmentId(e.target.value)}
									placeholder="e.g., env_xxxxx"
								/>
								<p className="text-muted-foreground text-xs">
									Found in Mux Dashboard → Settings → Environment. Used for
									webhook routing.
								</p>
							</div>

							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="tokenId">Token ID</Label>
									<PasswordInput
										id="tokenId"
										value={tokenId}
										onChange={(e) => setTokenId(e.target.value)}
										placeholder="No Token ID configured"
									/>
									<p className="text-muted-foreground text-xs">
										Click the eye icon to reveal. Edit to change.
									</p>
								</div>

								<div className="space-y-2">
									<Label htmlFor="tokenSecret">Token Secret</Label>
									<PasswordInput
										id="tokenSecret"
										value={tokenSecret}
										onChange={(e) => setTokenSecret(e.target.value)}
										placeholder="Enter new secret to change"
									/>
									<p className="text-muted-foreground text-xs">
										Leave empty to keep existing secret.
									</p>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={handleTestCredentials}
									disabled={
										!tokenId ||
										!tokenSecret ||
										testCredentialsMutation.isPending
									}
								>
									{testCredentialsMutation.isPending ? (
										<Loader2 className="mr-2 size-4 animate-spin" />
									) : null}
									Test Credentials
								</Button>
								<span className="text-muted-foreground text-xs">
									Verify your credentials before saving
								</span>
							</div>

							<div className="border-t pt-6">
								<h4 className="mb-4 text-sm font-medium">
									Signing Keys (Optional)
								</h4>
								<p className="text-muted-foreground mb-4 text-sm">
									Signing keys are required for signed playback URLs. You can
									generate these in your Mux dashboard.
								</p>
								<div className="grid gap-4 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="signingKeyId">Signing Key ID</Label>
										<PasswordInput
											id="signingKeyId"
											value={signingKeyId}
											onChange={(e) => setSigningKeyId(e.target.value)}
											placeholder="No Signing Key configured"
										/>
										<p className="text-muted-foreground text-xs">
											Click the eye icon to reveal. Edit to change.
										</p>
									</div>

									<div className="space-y-2">
										<Label htmlFor="signingKeyPrivate">
											Signing Key Private
										</Label>
										<Textarea
											id="signingKeyPrivate"
											value={signingKeyPrivate}
											onChange={(e) => setSigningKeyPrivate(e.target.value)}
											placeholder="Enter new private key to change"
											rows={3}
											className="font-mono text-xs"
										/>
										<p className="text-muted-foreground text-xs">
											Leave empty to keep existing key.
										</p>
									</div>
								</div>
							</div>

							<div className="border-t pt-6">
								<h4 className="mb-4 text-sm font-medium">
									Webhook Configuration
								</h4>
								<p className="text-muted-foreground mb-4 text-sm">
									The webhook secret is used to verify incoming webhooks from
									Mux. Configure your webhook in the Mux dashboard to point to
									your webhook endpoint.
								</p>
								<div className="space-y-2">
									<Label htmlFor="webhookSecret">Webhook Signing Secret</Label>
									<PasswordInput
										id="webhookSecret"
										value={webhookSecret}
										onChange={(e) => setWebhookSecret(e.target.value)}
										placeholder="No webhook secret configured"
									/>
									<p className="text-muted-foreground text-xs">
										Click the eye icon to reveal. Found in Mux Dashboard →
										Settings → Webhooks → Signing Secret
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Save Button */}
				<div className="flex justify-end gap-4">
					<Button variant="outline" asChild>
						<Link to="/">Cancel</Link>
					</Button>
					<Button
						onClick={handleSave}
						disabled={updateMutation.isPending || !name}
					>
						{updateMutation.isPending ? (
							<Loader2 className="mr-2 size-4 animate-spin" />
						) : (
							<Save className="mr-2 size-4" />
						)}
						Save Changes
					</Button>
				</div>
			</div>
		</>
	);
}
