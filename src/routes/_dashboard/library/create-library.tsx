import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
	CheckCircle,
	KeyRound,
	Library,
	Loader2,
	Settings,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DashboardHeader } from '@/components/DashboardHeader';
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
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export const Route = createFileRoute('/_dashboard/library/create-library')({
	component: CreateLibraryPage,
});

function CreateLibraryPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	// Form state
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [tokenId, setTokenId] = useState('');
	const [tokenSecret, setTokenSecret] = useState('');
	const [signingKeyId, setSigningKeyId] = useState('');
	const [signingKeyPrivate, setSigningKeyPrivate] = useState('');
	const [defaultPlaybackPolicy, setDefaultPlaybackPolicy] = useState<
		'public' | 'signed'
	>('public');
	const [defaultVideoQuality, setDefaultVideoQuality] = useState<
		'basic' | 'plus' | 'premium'
	>('plus');
	const [isDefault, setIsDefault] = useState(false);
	const [credentialsVerified, setCredentialsVerified] = useState(false);

	// Create mutation
	const createMutation = useMutation(
		trpc.mux.createLibrary.mutationOptions({
			onSuccess: () => {
				toast.success('Library created successfully');
				queryClient.invalidateQueries({
					queryKey: trpc.mux.listLibraries.queryKey(),
				});
				navigate({ to: '/' });
			},
			onError: (error) => {
				toast.error(`Failed to create library: ${error.message}`);
			},
		}),
	);

	// Test credentials mutation
	const testCredentialsMutation = useMutation(
		trpc.mux.testLibraryCredentials.mutationOptions({
			onSuccess: (result) => {
				if (result.success) {
					toast.success('Credentials are valid!');
					setCredentialsVerified(true);
				} else {
					toast.error(result.message);
					setCredentialsVerified(false);
				}
			},
			onError: (error) => {
				toast.error(`Test failed: ${error.message}`);
				setCredentialsVerified(false);
			},
		}),
	);

	const handleTestCredentials = () => {
		if (!tokenId || !tokenSecret) {
			toast.error('Please enter both Token ID and Token Secret to test');
			return;
		}
		testCredentialsMutation.mutate({ tokenId, tokenSecret });
	};

	const handleCreate = () => {
		if (!name || !tokenId || !tokenSecret) {
			toast.error('Please fill in all required fields');
			return;
		}

		createMutation.mutate({
			name,
			description: description || undefined,
			tokenId,
			tokenSecret,
			signingKeyId: signingKeyId || undefined,
			signingKeyPrivate: signingKeyPrivate || undefined,
			defaultPlaybackPolicy,
			defaultVideoQuality,
			isDefault,
		});
	};

	const canCreate = name && tokenId && tokenSecret;

	return (
		<>
			<DashboardHeader
				heading="Create Video Library"
				text="Set up a new video library"
			>
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink href="/">&larr; Back to Libraries</BreadcrumbLink>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</DashboardHeader>

			<section className="space-y-6">
				<div className="grid gap-6 lg:grid-cols-2">
					{/* General Settings */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Settings className="size-5" />
								General Settings
							</CardTitle>
							<CardDescription>
								Basic information about video library.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="name">
									Library Name <span className="text-destructive">*</span>
								</Label>
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
										setDefaultPlaybackPolicy(value as 'public' | 'signed')
									}
								>
									<SelectTrigger id="playbackPolicy">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="public">Public</SelectItem>
										<SelectItem value="signed">Signed</SelectItem>
									</SelectContent>
								</Select>
								<p className="text-muted-foreground text-xs">
									Public videos can be accessed by anyone. Signed videos require
									a token.
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
								API Credentials
							</CardTitle>
							<CardDescription>
								Enter API credentials. Request them from technical support.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="tokenId">
										Token ID <span className="text-destructive">*</span>
									</Label>
									<Input
										id="tokenId"
										value={tokenId}
										onChange={(e) => {
											setTokenId(e.target.value);
											setCredentialsVerified(false);
										}}
										placeholder="Enter Token ID"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="tokenSecret">
										Token Secret <span className="text-destructive">*</span>
									</Label>
									<Input
										id="tokenSecret"
										type="password"
										value={tokenSecret}
										onChange={(e) => {
											setTokenSecret(e.target.value);
											setCredentialsVerified(false);
										}}
										placeholder="Enter Token Secret"
									/>
								</div>
							</div>

							<div className="flex items-center gap-3">
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
								{credentialsVerified && (
									<span className="flex items-center gap-1 text-sm text-green-600">
										<CheckCircle className="size-4" />
										Verified
									</span>
								)}
							</div>

							<div className="border-t pt-6">
								<h4 className="mb-4 text-sm font-medium">
									Signing Keys (Optional)
								</h4>
								<p className="text-muted-foreground mb-4 text-sm">
									Signing keys are required for signed playback URLs. Request
									them from technical support.
								</p>
								<div className="grid gap-4 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="signingKeyId">Signing Key ID</Label>
										<Input
											id="signingKeyId"
											value={signingKeyId}
											onChange={(e) => setSigningKeyId(e.target.value)}
											placeholder="Enter Signing Key ID"
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="signingKeyPrivate">
											Signing Key Private
										</Label>
										<Textarea
											id="signingKeyPrivate"
											value={signingKeyPrivate}
											onChange={(e) => setSigningKeyPrivate(e.target.value)}
											placeholder="Paste private key here"
											rows={3}
											className="font-mono text-xs"
										/>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Create Button */}
				<div className="flex justify-end gap-4">
					<Button variant="outline" asChild>
						<Link to="/">Cancel</Link>
					</Button>
					<Button
						onClick={handleCreate}
						disabled={createMutation.isPending || !canCreate}
					>
						{createMutation.isPending ? (
							<Loader2 className="mr-2 size-4 animate-spin" />
						) : (
							<Library className="mr-2 size-4" />
						)}
						Create Library
					</Button>
				</div>
			</section>
		</>
	);
}
