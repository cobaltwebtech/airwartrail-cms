import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	createFileRoute,
	Link,
	notFound,
	useNavigate,
} from '@tanstack/react-router';
import { TRPCClientError } from '@trpc/client';
import {
	AlertTriangle,
	ArrowLeft,
	Check,
	CirclePlay,
	Copy,
	Globe,
	Info,
	KeyRound,
	Loader2,
	Plus,
	Save,
	Settings,
	Shield,
	Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DashboardHeader } from '@/components/DashboardHeader';
import { NotFound } from '@/components/NotFound';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
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
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute(
	'/_dashboard/library/edit-library/$libraryId',
)({
	component: LibrarySettingsPage,
	notFoundComponent: NotFound,
	loader: async ({ context: { queryClient }, params }) => {
		const { libraryId } = params;

		// Guard against missing libraryId
		if (!libraryId) {
			return { libraryId };
		}

		try {
			const library = await queryClient.ensureQueryData(
				trpc.mux.getLibrary.queryOptions({ libraryId }),
			);
			if (!library) {
				throw notFound();
			}
			return { libraryId };
		} catch (error) {
			if (
				error instanceof TRPCClientError &&
				error.data?.code === 'NOT_FOUND'
			) {
				throw notFound();
			}
			throw error;
		}
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
		'public' | 'signed'
	>('public');
	const [defaultVideoQuality, setDefaultVideoQuality] = useState<
		'basic' | 'plus' | 'premium'
	>('plus');
	const [isDefault, setIsDefault] = useState(false);
	const [defaultPlaybackRestrictionId, setDefaultPlaybackRestrictionId] =
		useState<string | null>(null);
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
		setDefaultPlaybackRestrictionId(
			library.defaultPlaybackRestrictionId || null,
		);
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

	// Playback Restrictions state
	const [newRestrictionDomains, setNewRestrictionDomains] = useState('');
	const [newRestrictionAllowNoReferrer, setNewRestrictionAllowNoReferrer] =
		useState(false);
	const [newRestrictionAllowNoUserAgent, setNewRestrictionAllowNoUserAgent] =
		useState(false);
	const [
		newRestrictionAllowHighRiskUserAgent,
		setNewRestrictionAllowHighRiskUserAgent,
	] = useState(false);
	const [isCreateRestrictionDialogOpen, setIsCreateRestrictionDialogOpen] =
		useState(false);

	// Playback Restrictions query
	const {
		data: playbackRestrictions,
		isLoading: isLoadingRestrictions,
		refetch: refetchRestrictions,
	} = useQuery(trpc.mux.listPlaybackRestrictions.queryOptions({ libraryId }));

	// Create playback restriction mutation
	const createRestrictionMutation = useMutation(
		trpc.mux.createPlaybackRestriction.mutationOptions({
			onSuccess: (newRestriction) => {
				toast.success('Playback restriction created');
				refetchRestrictions();
				setIsCreateRestrictionDialogOpen(false);
				setNewRestrictionDomains('');
				setNewRestrictionAllowNoReferrer(false);
				setNewRestrictionAllowNoUserAgent(false);
				setNewRestrictionAllowHighRiskUserAgent(false);

				// If this was set as the default by the backend, update local state and sync
				if (newRestriction?.setAsDefault && newRestriction?.id) {
					setDefaultPlaybackRestrictionId(newRestriction.id);
					toast.info('This restriction has been set as the default.');
					// Invalidate the library query to sync with database
					queryClient.invalidateQueries({
						queryKey: trpc.mux.getLibrary.queryKey({ libraryId }),
					});
				}
			},
			onError: (error) => {
				toast.error(`Failed to create restriction: ${error.message}`);
			},
		}),
	);

	// Update referrer restriction mutation
	const updateReferrerMutation = useMutation(
		trpc.mux.updatePlaybackRestrictionReferrer.mutationOptions({
			onError: (error) => {
				toast.error(`Failed to update referrer: ${error.message}`);
			},
		}),
	);

	// Update user agent restriction mutation
	const updateUserAgentMutation = useMutation(
		trpc.mux.updatePlaybackRestrictionUserAgent.mutationOptions({
			onError: (error) => {
				toast.error(`Failed to update user agent: ${error.message}`);
			},
		}),
	);

	// Combined save handler for both referrer and user agent settings
	const [isSavingRestriction, setIsSavingRestriction] = useState(false);
	const handleSaveRestriction = async (data: {
		libraryId: string;
		restrictionId: string;
		allowedDomains: string[];
		allowNoReferrer: boolean;
		allowNoUserAgent: boolean;
		allowHighRiskUserAgent: boolean;
	}) => {
		setIsSavingRestriction(true);
		try {
			// Update both referrer and user agent settings
			await Promise.all([
				updateReferrerMutation.mutateAsync({
					libraryId: data.libraryId,
					restrictionId: data.restrictionId,
					allowedDomains: data.allowedDomains,
					allowNoReferrer: data.allowNoReferrer,
				}),
				updateUserAgentMutation.mutateAsync({
					libraryId: data.libraryId,
					restrictionId: data.restrictionId,
					allowNoUserAgent: data.allowNoUserAgent,
					allowHighRiskUserAgent: data.allowHighRiskUserAgent,
				}),
			]);
			toast.success('Restriction settings updated');
			refetchRestrictions();
		} catch {
			// Individual mutation errors are already handled by onError callbacks
		} finally {
			setIsSavingRestriction(false);
		}
	};

	// Delete playback restriction mutation
	const deleteRestrictionMutation = useMutation(
		trpc.mux.deletePlaybackRestriction.mutationOptions({
			onSuccess: (data, variables) => {
				toast.success('Playback restriction deleted');
				refetchRestrictions();

				// If the deleted restriction was the default, the backend already cleared it
				// Update local state to match and notify user
				if (
					data.clearedDefault ||
					variables.restrictionId === defaultPlaybackRestrictionId
				) {
					setDefaultPlaybackRestrictionId(null);
					toast.warning(
						'The default playback restriction was deleted. Please select a new default.',
					);
					// Invalidate the library query to sync with database
					queryClient.invalidateQueries({
						queryKey: trpc.mux.getLibrary.queryKey({ libraryId }),
					});
				}
			},
			onError: (error) => {
				toast.error(`Failed to delete restriction: ${error.message}`);
			},
		}),
	);

	const handleCreateRestriction = () => {
		const domains = newRestrictionDomains
			.split('\n')
			.map((d) => d.trim())
			.filter((d) => d.length > 0);

		if (domains.length === 0) {
			toast.error('Please enter at least one domain');
			return;
		}

		createRestrictionMutation.mutate({
			libraryId,
			referrer: {
				allowedDomains: domains,
				allowNoReferrer: newRestrictionAllowNoReferrer,
			},
			userAgent: {
				allowNoUserAgent: newRestrictionAllowNoUserAgent,
				allowHighRiskUserAgent: newRestrictionAllowHighRiskUserAgent,
			},
		});
	};

	const handleSave = () => {
		const updateData: Parameters<typeof updateMutation.mutate>[0] = {
			libraryId,
			name,
			description: description || null,
			defaultPlaybackPolicy,
			defaultPlaybackRestrictionId: defaultPlaybackRestrictionId,
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
			>
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink href="/libraries">All Libraries</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbLink href={`/library/${libraryId}/videos`}>
								{library.name} Videos
							</BreadcrumbLink>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</DashboardHeader>

			<section className="space-y-6">
				<div className="flex items-center justify-end"></div>

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
							<CardTitle className="flex items-center gap-2">
								<CirclePlay className="size-5" />
								Playback Settings
							</CardTitle>
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
								Library API credentials. Leave fields empty to keep existing
								values.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="space-y-2">
								<Label htmlFor="muxEnvironmentId">Environment ID</Label>
								<Input
									id="muxEnvironmentId"
									value={muxEnvironmentId}
									onChange={(e) => setMuxEnvironmentId(e.target.value)}
									placeholder="e.g., env_xxxxx"
								/>
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
									Signing keys are required for signed playback URLs.
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
									The webhook secret used to verify the signature of incoming
									webhooks. The webhook endpoint is:{' '}
									<code className="bg-secondary text-primary px-3 py-2 rounded-sm">
										https://dashboard.airwartrail.com/api/webhooks/mux
									</code>
								</p>
								<div className="space-y-2">
									<Label htmlFor="webhookSecret">Webhook Signing Secret</Label>
									<PasswordInput
										id="webhookSecret"
										value={webhookSecret}
										onChange={(e) => setWebhookSecret(e.target.value)}
										placeholder="No webhook secret configured"
									/>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Playback Restrictions */}
					<Card className="lg:col-span-2">
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="flex items-center gap-2">
										<Shield className="size-5" />
										Playback Restrictions
									</CardTitle>
									<CardDescription>
										Control which domains can play your videos and restrict
										access based on user agent.
									</CardDescription>
								</div>
								<div className="flex items-center gap-2">
									<Dialog>
										<DialogTrigger asChild>
											<Button variant="outline" size="sm">
												<Info className="mr-2 size-4" />
												Help
											</Button>
										</DialogTrigger>
										<DialogContent className="lg:max-w-4xl max-h-[80svh] overflow-y-auto">
											<DialogHeader>
												<DialogTitle>Playback Restrictions Guide</DialogTitle>
												<DialogDescription>
													Understanding domain and user agent restrictions for
													video playback
												</DialogDescription>
											</DialogHeader>
											<div className="space-y-6 py-4">
												{/* Overview */}
												<div>
													<h4 className="mb-2 text-sm font-semibold">
														What are Playback Restrictions?
													</h4>
													<p className="text-muted-foreground text-sm">
														Playback Restrictions add an extra layer of security
														by controlling where your videos can be played. They
														work alongside signed playback policies (JWT tokens)
														to prevent unauthorized access.
													</p>
												</div>

												{/* Allowed Domains */}
												<div className="border-t pt-4">
													<h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
														<Globe className="size-4" />
														Allowed Domains
													</h4>
													<p className="text-muted-foreground mb-3 text-sm">
														Specify which domains can play your videos. Use
														wildcards (*) for subdomains.
													</p>
													<div className="bg-muted space-y-2 rounded-md p-3 text-sm">
														<div>
															<strong>Your domain:</strong>{' '}
															<code className="bg-background px-1.5 py-0.5">
																*.airwartrail.com
															</code>
														</div>
														<div>
															<strong>Chromecast support:</strong>{' '}
															<code className="bg-background px-1.5 py-0.5">
																www.gstatic.com
															</code>
														</div>
														<div>
															<strong>AirPlay support:</strong>{' '}
															<code className="bg-background px-1.5 py-0.5">
																mediaservices.cdn-apple.com
															</code>
														</div>
													</div>
												</div>

												{/* Casting Support */}
												<div className="border-t pt-4">
													<h4 className="mb-2 text-sm font-semibold">
														Chromecast & AirPlay
													</h4>
													<div className="space-y-3 text-sm">
														<div>
															<p className="font-medium">
																✅ Chromecast (all devices)
															</p>
															<p className="text-muted-foreground text-xs">
																Add{' '}
																<code className="bg-muted px-1 py-0.5">
																	www.gstatic.com
																</code>{' '}
																to allowed domains. Users can cast from mobile
																browsers or desktop.
															</p>
														</div>
														<div>
															<p className="font-medium">
																✅ AirPlay to third-party devices
															</p>
															<p className="text-muted-foreground text-xs">
																Add{' '}
																<code className="bg-muted px-1 py-0.5">
																	mediaservices.cdn-apple.com
																</code>{' '}
																to allowed domains. Works with AirPlay-enabled
																smart TVs and receivers.
															</p>
														</div>
														<div>
															<p className="font-medium">
																⚠️ AirPlay to Apple TV, HomePod
															</p>
															<p className="text-muted-foreground text-xs">
																First-party Apple devices (Apple TV 4K, HomePod)
																never send a referrer header. You must set{' '}
																<strong>Allow No Referrer = true</strong> for
																these devices to work.
															</p>
														</div>
													</div>
												</div>

												{/* Allow No Referrer */}
												<div className="border-t pt-4">
													<h4 className="mb-2 text-sm font-semibold">
														Allow No Referrer
													</h4>
													<p className="text-muted-foreground mb-3 text-sm">
														The Referer HTTP header contains the domain
														requesting the video. Browsers always send it, but
														some contexts don't.
													</p>
													<div className="space-y-2 text-sm">
														<div className="bg-green-500/10 text-green-900 dark:text-green-100 rounded-md p-3">
															<p className="font-medium">
																✅ Set to FALSE (more secure)
															</p>
															<p className="text-xs opacity-80">
																Best for web-only apps. Blocks native apps and
																Apple TV casting, but provides better security.
															</p>
														</div>
														<div className="bg-yellow-500/10 text-yellow-900 dark:text-yellow-100 rounded-md p-3">
															<p className="font-medium">
																⚠️ Set to TRUE (less secure)
															</p>
															<p className="text-xs opacity-80">
																Required for native iOS/Android apps and AirPlay
																to Apple TV. Less secure since requests without
																referrer are allowed. Still safe with signed
																playback since JWT is required.
															</p>
														</div>
													</div>
												</div>

												{/* User Agent Settings */}
												<div className="border-t pt-4">
													<h4 className="mb-2 text-sm font-semibold">
														User Agent Settings
													</h4>
													<div className="space-y-3 text-sm">
														<div>
															<p className="font-medium">Allow No User Agent</p>
															<p className="text-muted-foreground text-xs">
																Set to <strong>false</strong> to require all
																requests include a User-Agent header. Browsers
																always send this. Set to <strong>true</strong>{' '}
																only if you need to support certain embedded
																players or devices that don't send this header.
															</p>
														</div>
														<div>
															<p className="font-medium">
																Allow High Risk User Agents
															</p>
															<p className="text-muted-foreground text-xs">
																Set to <strong>false</strong> to block user
																agents known to be associated with suspicious
																activity (e.g., scraping bots, download tools).
																Recommended for all production environments.
															</p>
														</div>
													</div>
												</div>

												{/* Recommended Configuration */}
												<div className="bg-primary/5 border-primary/20 border rounded-lg p-4">
													<h4 className="mb-3 text-sm font-semibold">
														📋 Recommended for Web-Only Apps
													</h4>
													<div className="space-y-2 text-sm">
														<div>
															<strong>Allowed Domains:</strong>
															<ul className="text-muted-foreground mt-1 list-inside list-disc text-xs">
																<li>*.airwartrail.com (your domain)</li>
																<li>www.gstatic.com (Chromecast)</li>
																<li>
																	mediaservices.cdn-apple.com (AirPlay to
																	third-party devices)
																</li>
															</ul>
														</div>
														<div>
															<strong>Allow No Referrer:</strong>{' '}
															<code className="bg-background px-1.5 py-0.5">
																true
															</code>{' '}
															<span className="text-muted-foreground text-xs">
																(enables Apple TV/HomePod casting)
															</span>
														</div>
														<div>
															<strong>Allow No User Agent:</strong>{' '}
															<code className="bg-background px-1.5 py-0.5">
																false
															</code>
														</div>
														<div>
															<strong>Allow High Risk User Agent:</strong>{' '}
															<code className="bg-background px-1.5 py-0.5">
																false
															</code>
														</div>
													</div>
													<p className="text-muted-foreground mt-3 text-xs">
														💡 Since you're using signed playback (JWT
														required), setting Allow No Referrer to true is
														safe. The JWT provides the primary security layer.
													</p>
												</div>
											</div>
											<DialogFooter>
												<DialogClose asChild>
													<Button>Got it</Button>
												</DialogClose>
											</DialogFooter>
										</DialogContent>
									</Dialog>
									<Dialog
										open={isCreateRestrictionDialogOpen}
										onOpenChange={setIsCreateRestrictionDialogOpen}
									>
										<DialogTrigger asChild>
											<Button size="sm">
												<Plus className="mr-2 size-4" />
												Add Restriction
											</Button>
										</DialogTrigger>
										<DialogContent className="max-w-lg">
											<DialogHeader>
												<DialogTitle>Create Playback Restriction</DialogTitle>
												<DialogDescription>
													Configure domain and user agent restrictions for video
													playback.
												</DialogDescription>
											</DialogHeader>
											<div className="space-y-4 py-4">
												<div className="space-y-2">
													<Label htmlFor="newDomains">Allowed Domains</Label>
													<Textarea
														id="newDomains"
														value={newRestrictionDomains}
														onChange={(e) =>
															setNewRestrictionDomains(e.target.value)
														}
														placeholder="*.example.com&#10;app.example.com&#10;localhost:3000"
														rows={4}
													/>
													<p className="text-muted-foreground text-xs">
														Enter one domain per line. Use * for wildcards
														(e.g., *.example.com). Use an empty list to deny all
														domains.
													</p>
												</div>

												<div className="flex items-center justify-between">
													<div className="space-y-0.5">
														<Label htmlFor="allowNoReferrer">
															Allow No Referrer
														</Label>
														<p className="text-muted-foreground text-xs">
															Allow playback from requests without a Referer
															header (e.g., native apps, smart TVs).
														</p>
													</div>
													<Switch
														id="allowNoReferrer"
														checked={newRestrictionAllowNoReferrer}
														onCheckedChange={setNewRestrictionAllowNoReferrer}
													/>
												</div>

												<div className="border-t pt-4">
													<h4 className="mb-3 text-sm font-medium">
														User Agent Settings
													</h4>

													<div className="space-y-4">
														<div className="flex items-center justify-between">
															<div className="space-y-0.5">
																<Label htmlFor="allowNoUserAgent">
																	Allow No User Agent
																</Label>
																<p className="text-muted-foreground text-xs">
																	Allow requests without a User-Agent header.
																</p>
															</div>
															<Switch
																id="allowNoUserAgent"
																checked={newRestrictionAllowNoUserAgent}
																onCheckedChange={
																	setNewRestrictionAllowNoUserAgent
																}
															/>
														</div>

														<div className="flex items-center justify-between">
															<div className="space-y-0.5">
																<Label htmlFor="allowHighRiskUserAgent">
																	Allow High Risk User Agents
																</Label>
																<p className="text-muted-foreground text-xs">
																	Allow user agents identified as high risk by
																	Mux.
																</p>
															</div>
															<Switch
																id="allowHighRiskUserAgent"
																checked={newRestrictionAllowHighRiskUserAgent}
																onCheckedChange={
																	setNewRestrictionAllowHighRiskUserAgent
																}
															/>
														</div>
													</div>
												</div>
											</div>
											<DialogFooter>
												<DialogClose asChild>
													<Button variant="outline">Cancel</Button>
												</DialogClose>
												<Button
													onClick={handleCreateRestriction}
													disabled={createRestrictionMutation.isPending}
												>
													{createRestrictionMutation.isPending ? (
														<Loader2 className="mr-2 size-4 animate-spin" />
													) : null}
													Create Restriction
												</Button>
											</DialogFooter>
										</DialogContent>
									</Dialog>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							{/* Default Restriction Selector */}
							{playbackRestrictions && playbackRestrictions.length > 0 && (
								<div className="mb-6 space-y-3">
									{/* Warning if default restriction no longer exists in Mux */}
									{defaultPlaybackRestrictionId &&
										!playbackRestrictions.some(
											(r) => r.id === defaultPlaybackRestrictionId,
										) && (
											<div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md p-3 text-sm">
												<AlertTriangle className="size-4 shrink-0" />
												<span>
													The configured default restriction no longer exists in
													Mux. Please select a new default.
												</span>
											</div>
										)}

									{/* Warning if no default is set */}
									{!defaultPlaybackRestrictionId && (
										<div className="bg-yellow-500/10 text-yellow-900 dark:text-yellow-100 flex items-center gap-2 rounded-md p-3 text-sm">
											<AlertTriangle className="size-4 shrink-0" />
											<span>
												No default playback restriction is set. Select one below
												to apply restrictions to signed playback URLs.
											</span>
										</div>
									)}

									<div className="space-y-2">
										<Label htmlFor="defaultRestriction">
											Default Playback Restriction
										</Label>
										<Select
											value={defaultPlaybackRestrictionId || 'none'}
											onValueChange={(value) =>
												setDefaultPlaybackRestrictionId(
													value === 'none' ? null : value,
												)
											}
										>
											<SelectTrigger id="defaultRestriction">
												<SelectValue placeholder="Select a default restriction" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">No default</SelectItem>
												{playbackRestrictions.map((restriction) => (
													<SelectItem
														key={restriction.id}
														value={restriction.id}
													>
														{restriction.id}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>
							)}

							{isLoadingRestrictions ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="text-muted-foreground size-6 animate-spin" />
								</div>
							) : playbackRestrictions && playbackRestrictions.length > 0 ? (
								<Accordion
									type="single"
									collapsible
									className="w-full space-y-2"
								>
									{playbackRestrictions.map((restriction) => (
										<PlaybackRestrictionItem
											key={restriction.id}
											restriction={restriction}
											libraryId={libraryId}
											defaultPlaybackRestrictionId={
												defaultPlaybackRestrictionId
											}
											onSaveRestriction={handleSaveRestriction}
											onDelete={(restrictionId) =>
												deleteRestrictionMutation.mutate({
													restrictionId,
													libraryId,
												})
											}
											isSaving={isSavingRestriction}
											isDeleting={deleteRestrictionMutation.isPending}
										/>
									))}
								</Accordion>
							) : (
								<div className="text-muted-foreground py-8 text-center">
									<Shield className="mx-auto mb-3 size-10 opacity-50" />
									<p className="text-sm">No playback restrictions configured</p>
									<p className="text-xs">
										Add a restriction to control video playback access.
									</p>
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Save Button */}
				<div className="flex justify-between gap-4">
					<div className="flex gap-2">
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
						<Button variant="outline" asChild>
							<Link to="/">Cancel</Link>
						</Button>
					</div>
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
									Are you sure you want to delete{' '}
									<span className="text-primary font-semibold">
										{library.name}
									</span>
									? This action cannot be undone. All videos associated with
									this library will become inaccessible in the dashboard.
									However, the videos will not be deleted and storage and usage
									costs will still be incurred. Contact support to permanently
									delete library and associated videos.
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
					</Dialog>{' '}
				</div>
			</section>
		</>
	);
}

// Types for playback restriction from Mux API
interface PlaybackRestriction {
	id: string;
	referrer?: {
		allowed_domains?: string[];
		allow_no_referrer?: boolean;
	};
	user_agent?: {
		allow_no_user_agent?: boolean;
		allow_high_risk_user_agent?: boolean;
	};
	created_at?: string;
	updated_at?: string;
}

interface PlaybackRestrictionItemProps {
	restriction: PlaybackRestriction;
	libraryId: string;
	defaultPlaybackRestrictionId: string | null;
	onSaveRestriction: (data: {
		libraryId: string;
		restrictionId: string;
		allowedDomains: string[];
		allowNoReferrer: boolean;
		allowNoUserAgent: boolean;
		allowHighRiskUserAgent: boolean;
	}) => void;
	onDelete: (restrictionId: string) => void;
	isSaving: boolean;
	isDeleting: boolean;
}

function PlaybackRestrictionItem({
	restriction,
	libraryId,
	defaultPlaybackRestrictionId,
	onSaveRestriction,
	onDelete,
	isSaving,
	isDeleting,
}: PlaybackRestrictionItemProps) {
	const [editDomains, setEditDomains] = useState(
		restriction.referrer?.allowed_domains?.join('\n') || '',
	);
	const [allowNoReferrer, setAllowNoReferrer] = useState(
		restriction.referrer?.allow_no_referrer ?? false,
	);
	const [allowNoUserAgent, setAllowNoUserAgent] = useState(
		restriction.user_agent?.allow_no_user_agent ?? true,
	);
	const [allowHighRiskUserAgent, setAllowHighRiskUserAgent] = useState(
		restriction.user_agent?.allow_high_risk_user_agent ?? true,
	);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isCopied, setIsCopied] = useState(false);

	const handleSaveRestriction = () => {
		const domains = editDomains
			.split('\n')
			.map((d) => d.trim())
			.filter((d) => d.length > 0);

		onSaveRestriction({
			libraryId,
			restrictionId: restriction.id,
			allowedDomains: domains,
			allowNoReferrer,
			allowNoUserAgent,
			allowHighRiskUserAgent,
		});
	};

	const domainsCount = restriction.referrer?.allowed_domains?.length || 0;

	return (
		<AccordionItem value={restriction.id} className="border rounded-lg px-4">
			<AccordionTrigger className="hover:no-underline">
				<div className="space-y-1">
					<p className="text-sm">
						Playback Restriction ID{' '}
						<span className="font-mono">{restriction.id}</span>
					</p>
					<p className="text-xs text-muted-foreground">
						{domainsCount} domain{domainsCount !== 1 ? 's' : ''} allowed
					</p>
					{restriction.id === defaultPlaybackRestrictionId && (
						<Badge variant="default" className="text-xs">
							Default
						</Badge>
					)}
				</div>
			</AccordionTrigger>
			<AccordionContent className="space-y-6 pt-4">
				{/* Restriction ID with Copy Button */}
				<div className="w-fit bg-secondary flex items-center justify-start gap-4 rounded-md p-3">
					<div className="flex flex-col gap-1">
						<span className="text-xs text-muted-foreground">
							Restriction ID
						</span>
						<code className="text-xs font-mono">{restriction.id}</code>
					</div>
					<Button
						size="sm"
						variant="outline"
						onClick={() => {
							navigator.clipboard.writeText(restriction.id);
							toast.success('Restriction ID copied to clipboard');
							setIsCopied(true);
							setTimeout(() => setIsCopied(false), 5000);
						}}
					>
						{isCopied ? (
							<Check className="size-4 text-accent" />
						) : (
							<Copy className="size-4" />
						)}
						Copy ID
					</Button>
				</div>

				{/* Referrer Settings */}
				<div className="space-y-4">
					<h4 className="text-sm font-medium flex items-center gap-2">
						<Globe className="size-4" />
						Referrer Restrictions
					</h4>

					<div className="space-y-2">
						<Label>Allowed Domains</Label>
						<Textarea
							value={editDomains}
							onChange={(e) => setEditDomains(e.target.value)}
							placeholder="*.example.com&#10;app.example.com"
							rows={4}
						/>
						<p className="text-muted-foreground text-xs">
							One domain per line. Use * for wildcards.
						</p>
					</div>

					{restriction.referrer?.allowed_domains &&
						restriction.referrer.allowed_domains.length > 0 && (
							<div className="flex flex-wrap gap-1">
								{restriction.referrer.allowed_domains.map((domain) => (
									<Badge key={domain} variant="secondary">
										{domain}
									</Badge>
								))}
							</div>
						)}

					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<Label>Allow No Referrer</Label>
							<p className="text-muted-foreground text-xs">
								Allow requests without a Referer header.
							</p>
						</div>
						<Switch
							checked={allowNoReferrer}
							onCheckedChange={setAllowNoReferrer}
						/>
					</div>
				</div>

				<Separator />

				{/* User Agent Settings */}
				<div className="space-y-4 pt-4">
					<h4 className="text-sm font-medium flex items-center gap-2">
						<Shield className="size-4" />
						User Agent Restrictions
					</h4>

					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="space-y-0.5">
								<Label>Allow No User Agent</Label>
								<p className="text-muted-foreground text-xs">
									Allow requests without a User-Agent header.
								</p>
							</div>
							<Switch
								checked={allowNoUserAgent}
								onCheckedChange={setAllowNoUserAgent}
							/>
						</div>

						<div className="flex items-center justify-between">
							<div className="space-y-0.5">
								<Label>Allow High Risk User Agents</Label>
								<p className="text-muted-foreground text-xs">
									Allow user agents identified as high risk.
								</p>
							</div>
							<Switch
								checked={allowHighRiskUserAgent}
								onCheckedChange={setAllowHighRiskUserAgent}
							/>
						</div>
					</div>
				</div>

				<Separator />

				{/* Actions */}
				<div className="pt-4 flex items-center justify-between">
					<Button onClick={handleSaveRestriction} disabled={isSaving}>
						{isSaving ? (
							<Loader2 className="mr-2 size-4 animate-spin" />
						) : (
							<Save className="mr-2 size-4" />
						)}
						Save Restriction Settings
					</Button>

					<Dialog
						open={isDeleteDialogOpen}
						onOpenChange={setIsDeleteDialogOpen}
					>
						<DialogTrigger asChild>
							<Button variant="destructive" size="sm">
								<Trash2 className="mr-2 size-4" />
								Delete Restriction
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Delete Playback Restriction</DialogTitle>
								<DialogDescription>
									Are you sure you want to delete this playback restriction?
									Videos using this restriction will no longer have domain or
									user agent restrictions applied.
								</DialogDescription>
							</DialogHeader>
							<DialogFooter>
								<DialogClose asChild>
									<Button variant="outline">Cancel</Button>
								</DialogClose>
								<Button
									variant="destructive"
									onClick={() => {
										onDelete(restriction.id);
										setIsDeleteDialogOpen(false);
									}}
									disabled={isDeleting}
								>
									{isDeleting ? (
										<Loader2 className="mr-2 size-4 animate-spin" />
									) : null}
									Delete
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			</AccordionContent>
		</AccordionItem>
	);
}
