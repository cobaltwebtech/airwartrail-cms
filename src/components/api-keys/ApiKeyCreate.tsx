import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Key, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc';

interface ApiKeyCreateProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

type CreatedKey = {
	id: string;
	name: string | null;
	key: string;
	start: string | null;
	prefix: string | null;
};

export function ApiKeyCreate({ isOpen, onOpenChange }: ApiKeyCreateProps) {
	const queryClient = useQueryClient();

	// Form state
	const [name, setName] = useState('');
	const [expiresIn, setExpiresIn] = useState<string>('never');
	const [permissions, setPermissions] = useState<Record<string, string[]>>({});

	// Created key state (to show the key after creation)
	const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);

	const { data: permissionOptions } = useQuery(
		trpc.apiKeys.getPermissionOptions.queryOptions(),
	);

	const createMutation = useMutation(
		trpc.apiKeys.create.mutationOptions({
			onSuccess: (data) => {
				toast.success('API key created successfully');
				setCreatedKey(data);
				queryClient.invalidateQueries({
					queryKey: trpc.apiKeys.list.queryKey(),
				});
			},
			onError: (error) => {
				toast.error(`Failed to create API key: ${error.message}`);
			},
		}),
	);

	const handleCreate = () => {
		if (!name.trim()) {
			toast.error('Please enter a name for the API key');
			return;
		}

		const expiresInSeconds =
			expiresIn === 'never' ? undefined : Number.parseInt(expiresIn, 10);

		createMutation.mutate({
			name: name.trim(),
			expiresIn: expiresInSeconds,
			permissions:
				Object.keys(permissions).length > 0 ? permissions : undefined,
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

	const copyToClipboard = async () => {
		if (createdKey?.key) {
			await navigator.clipboard.writeText(createdKey.key);
			toast.success('API key copied to clipboard');
		}
	};

	const handleClose = () => {
		// Reset state when closing
		setName('');
		setExpiresIn('never');
		setPermissions({});
		setCreatedKey(null);
		onOpenChange(false);
	};

	// Show the created key view
	if (createdKey) {
		return (
			<Dialog open={isOpen} onOpenChange={handleClose}>
				<DialogContent className="sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Key className="size-5 text-green-500" />
							API Key Created
						</DialogTitle>
						<DialogDescription>
							Copy your API key now. You won't be able to see it again!
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label>API Key</Label>
							<div className="flex gap-2">
								<Input
									value={createdKey.key}
									readOnly
									className="font-mono text-sm"
								/>
								<Button variant="outline" size="icon" onClick={copyToClipboard}>
									<Copy className="size-4" />
								</Button>
							</div>
							<p className="text-sm text-amber-600 dark:text-amber-400">
								⚠️ This is the only time you'll see this key. Store it securely!
							</p>
						</div>
					</div>
					<DialogFooter>
						<Button onClick={handleClose}>Done</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	// Show the create form
	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>Create API Key</DialogTitle>
					<DialogDescription>
						Create a new API key for external application access.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="api-key-name">Name *</Label>
						<Input
							id="api-key-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="My API Key"
						/>
						<p className="text-sm text-muted-foreground">
							A friendly name to identify this API key
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="api-key-expires">Expiration</Label>
						<Select value={expiresIn} onValueChange={setExpiresIn}>
							<SelectTrigger id="api-key-expires">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="never">Never expires</SelectItem>
								<SelectItem value="86400">1 day</SelectItem>
								<SelectItem value="604800">7 days</SelectItem>
								<SelectItem value="2592000">30 days</SelectItem>
								<SelectItem value="7776000">90 days</SelectItem>
								<SelectItem value="31536000">1 year</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Permissions */}
					<div className="space-y-3">
						<Label>Permissions</Label>
						{permissionOptions?.resources ? (
							<div className="grid gap-4 sm:grid-cols-3">
								{Object.entries(permissionOptions.resources).map(
									([resourceId, resource]) => (
										<div
											key={resourceId}
											className="rounded-lg border p-3 space-y-2"
										>
											<div>
												<h4 className="font-medium text-sm">
													{resource.label}
												</h4>
												<p className="text-xs text-muted-foreground">
													{resource.description}
												</p>
											</div>
											<div className="space-y-1">
												{resource.actions.map((action) => (
													<div
														key={action.id}
														className="flex items-center space-x-2"
													>
														<Checkbox
															id={`create-${resourceId}-${action.id}`}
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
															htmlFor={`create-${resourceId}-${action.id}`}
															className="text-sm font-normal cursor-pointer"
														>
															{action.label}
														</Label>
													</div>
												))}
											</div>
										</div>
									),
								)}
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								Loading permission options...
							</p>
						)}
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={handleClose}>
						Cancel
					</Button>
					<Button onClick={handleCreate} disabled={createMutation.isPending}>
						{createMutation.isPending ? (
							<Loader2 className="animate-spin" />
						) : (
							<Key />
						)}
						Create API Key
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
