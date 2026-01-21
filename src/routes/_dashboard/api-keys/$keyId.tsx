import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { format, formatDistanceToNow } from 'date-fns';
import { Key, Loader2, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ApiKeyDelete } from '@/components/api-keys/ApiKeyDelete';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Badge } from '@/components/ui/badge';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_dashboard/api-keys/$keyId')({
	loader: async ({ context: { queryClient }, params: { keyId } }) => {
		// Guard against missing keyId
		if (!keyId) {
			return { keyId };
		}

		await queryClient.ensureQueryData(trpc.apiKeys.get.queryOptions({ keyId }));
		await queryClient.ensureQueryData(
			trpc.apiKeys.getPermissionOptions.queryOptions(),
		);
	},
	component: EditApiKeyPage,
});

function EditApiKeyPage() {
	const { keyId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);

	const {
		data: apiKey,
		isLoading,
		error,
	} = useQuery(trpc.apiKeys.get.queryOptions({ keyId }));

	const { data: permissionOptions } = useQuery(
		trpc.apiKeys.getPermissionOptions.queryOptions(),
	);

	// Form state
	const [name, setName] = useState('');
	const [enabled, setEnabled] = useState(true);
	const [permissions, setPermissions] = useState<Record<string, string[]>>({});

	// Initialize form state when data loads
	useEffect(() => {
		if (apiKey) {
			setName(apiKey.name || '');
			setEnabled(apiKey.enabled ?? true);
			setPermissions(apiKey.permissions || {});
		}
	}, [apiKey]);

	const updateMutation = useMutation(
		trpc.apiKeys.update.mutationOptions({
			onSuccess: () => {
				toast.success('API key updated successfully');
				queryClient.invalidateQueries({
					queryKey: trpc.apiKeys.list.queryKey(),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.apiKeys.get.queryKey({ keyId }),
				});
			},
			onError: (error) => {
				toast.error(`Failed to update API key: ${error.message}`);
			},
		}),
	);

	const handleSave = () => {
		updateMutation.mutate({
			keyId,
			name: name || undefined,
			enabled,
			permissions,
		});
	};

	const handlePermissionChange = (
		resource: string,
		action: string,
		checked: boolean,
	) => {
		setPermissions((prev) => {
			const current = prev[resource] || [];
			if (checked) {
				return { ...prev, [resource]: [...current, action] };
			}
			const filtered = current.filter((a) => a !== action);
			if (filtered.length === 0) {
				const { [resource]: _, ...rest } = prev;
				return rest;
			}
			return { ...prev, [resource]: filtered };
		});
	};

	const hasPermission = (resource: string, action: string) => {
		return permissions[resource]?.includes(action) ?? false;
	};

	if (isLoading) {
		return <ApiKeyEditSkeleton />;
	}

	if (error || !apiKey) {
		return (
			<div className="text-destructive rounded-md bg-destructive/10 p-4">
				{error?.message || 'API key not found'}
			</div>
		);
	}

	return (
		<>
			<DashboardHeader
				heading="Edit API Key"
				text="Manage your API key settings"
			>
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink href="/api-keys">
								&larr; Back to API Keys
							</BreadcrumbLink>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</DashboardHeader>

			<div className="space-y-6">
				<div className="grid gap-6 lg:grid-cols-2">
					{/* General Settings */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Key className="size-5" />
								General Settings
							</CardTitle>
							<CardDescription>
								Basic configuration for this API key
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="name">Name</Label>
								<Input
									id="name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="My API Key"
								/>
								<p className="text-sm text-muted-foreground">
									A friendly name to identify this API key
								</p>
							</div>

							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label>Enabled</Label>
									<p className="text-sm text-muted-foreground">
										Disable to temporarily revoke access
									</p>
								</div>
								<Switch checked={enabled} onCheckedChange={setEnabled} />
							</div>

							<div className="space-y-2 pt-4 border-t">
								<Label>API Key</Label>
								<code className="block bg-secondary px-3 py-2 rounded-md text-sm w-fit">
									{apiKey.start}****
								</code>
								<p className="text-sm text-muted-foreground">
									For security reasons, the API key's full value is only shown
									when generated. If you lost or forgot it, you'll need to
									generate a new API key. Be sure to delete any unused keys to
									revoke access and update the application using the new key.
								</p>
							</div>
						</CardContent>
					</Card>

					{/* Key Information */}
					<Card>
						<CardHeader>
							<CardTitle>Key Information</CardTitle>
							<CardDescription>Usage statistics and details</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label className="text-muted-foreground">Status</Label>
									<div className="mt-1">
										{!apiKey.enabled ? (
											<Badge variant="secondary">Disabled</Badge>
										) : apiKey.expiresAt &&
											new Date(apiKey.expiresAt) < new Date() ? (
											<Badge variant="destructive">Expired</Badge>
										) : (
											<Badge variant="default">Active</Badge>
										)}
									</div>
								</div>
								<div>
									<Label className="text-muted-foreground">Created</Label>
									<p className="mt-1 text-sm">
										{format(new Date(apiKey.createdAt), 'PPP')}
									</p>
								</div>
								<div>
									<Label className="text-muted-foreground">Last Used</Label>
									<p className="mt-1 text-sm">
										{apiKey.lastRequest
											? formatDistanceToNow(new Date(apiKey.lastRequest), {
													addSuffix: true,
												})
											: 'Never'}
									</p>
								</div>
								<div>
									<Label className="text-muted-foreground">Request Count</Label>
									<p className="mt-1 text-sm">
										{apiKey.requestCount?.toLocaleString() ?? 0}
									</p>
								</div>
								{apiKey.expiresAt && (
									<div className="col-span-2">
										<Label className="text-muted-foreground">Expires</Label>
										<p className="mt-1 text-sm">
											{format(new Date(apiKey.expiresAt), 'PPP')}
											{new Date(apiKey.expiresAt) > new Date() && (
												<span className="text-muted-foreground ml-2">
													(
													{formatDistanceToNow(new Date(apiKey.expiresAt), {
														addSuffix: true,
													})}
													)
												</span>
											)}
										</p>
									</div>
								)}
							</div>

							{apiKey.rateLimitEnabled && (
								<div className="pt-4 border-t">
									<Label className="text-muted-foreground">Rate Limiting</Label>
									<p className="mt-1 text-sm">
										{apiKey.rateLimitMax} requests per{' '}
										{formatRateLimitWindow(apiKey.rateLimitTimeWindow)}
									</p>
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Permissions */}
				<Card>
					<CardHeader>
						<CardTitle>Permissions</CardTitle>
						<CardDescription>
							Control what this API key can access
						</CardDescription>
					</CardHeader>
					<CardContent>
						{permissionOptions?.resources ? (
							<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
								{Object.entries(permissionOptions.resources).map(
									([resourceId, resource]) => (
										<div key={resourceId} className="space-y-3">
											<div>
												<h4 className="font-medium">{resource.label}</h4>
												<p className="text-sm text-muted-foreground">
													{resource.description}
												</p>
											</div>
											<div className="space-y-2">
												{resource.actions.map((action) => (
													<div
														key={action.id}
														className="flex items-center space-x-2"
													>
														<Checkbox
															id={`${resourceId}-${action.id}`}
															checked={hasPermission(resourceId, action.id)}
															onCheckedChange={(checked) =>
																handlePermissionChange(
																	resourceId,
																	action.id,
																	checked === true,
																)
															}
														/>
														<Label
															htmlFor={`${resourceId}-${action.id}`}
															className="text-sm font-normal cursor-pointer"
														>
															{action.label}
															<span className="text-muted-foreground ml-1">
																- {action.description}
															</span>
														</Label>
													</div>
												))}
											</div>
										</div>
									),
								)}
							</div>
						) : (
							<p className="text-muted-foreground">Loading permissions...</p>
						)}
					</CardContent>
				</Card>

				{/* Actions */}
				<div className="flex justify-between">
					<Button variant="destructive" onClick={() => setIsDeleteOpen(true)}>
						<Trash2 />
						Delete API Key
					</Button>
					<Button onClick={handleSave} disabled={updateMutation.isPending}>
						{updateMutation.isPending ? (
							<Loader2 className="animate-spin" />
						) : (
							<Save />
						)}
						Save Changes
					</Button>
				</div>
			</div>

			{/* Delete Dialog */}
			<ApiKeyDelete
				apiKey={apiKey}
				isOpen={isDeleteOpen}
				onOpenChange={setIsDeleteOpen}
				onDeleted={() => navigate({ to: '/api-keys' })}
			/>
		</>
	);
}

function formatRateLimitWindow(ms: number | null): string {
	if (!ms) return 'unknown';
	const hours = ms / (1000 * 60 * 60);
	if (hours >= 24) return `${Math.round(hours / 24)} day(s)`;
	if (hours >= 1) return `${Math.round(hours)} hour(s)`;
	const minutes = ms / (1000 * 60);
	return `${Math.round(minutes)} minute(s)`;
}

function ApiKeyEditSkeleton() {
	return (
		<div className="space-y-6">
			<Skeleton className="h-8 w-48" />
			<div className="grid gap-6 lg:grid-cols-2">
				<Skeleton className="h-64" />
				<Skeleton className="h-64" />
			</div>
			<Skeleton className="h-48" />
		</div>
	);
}
