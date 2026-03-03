import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import { Key, Plus, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ApiKeyCreate } from '@/components/api-keys/ApiKeyCreate';
import { ApiKeyDelete } from '@/components/api-keys/ApiKeyDelete';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_dashboard/api-keys/')({
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData(trpc.apiKeys.list.queryOptions({}));
	},
	component: ApiKeysPage,
});

// Type for API key from list endpoint
type ApiKey = {
	id: string;
	configId: string;
	referenceId: string;
	name: string | null;
	start: string | null;
	prefix: string | null;
	enabled: boolean;
	expiresAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	lastRequest: Date | null;
	requestCount: number;
	rateLimitEnabled: boolean;
	rateLimitMax: number | null;
	rateLimitTimeWindow: number | null;
	permissions: Record<string, string[]> | null;
	metadata: Record<string, unknown> | null;
};

function ApiKeysPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [deleteKey, setDeleteKey] = useState<ApiKey | null>(null);

	const {
		data: response,
		isLoading,
		error,
	} = useQuery(trpc.apiKeys.list.queryOptions({}));

	const apiKeys = response?.apiKeys ?? [];

	return (
		<>
			<DashboardHeader
				heading="API Keys"
				text="Manage API keys for external application access."
			>
				<Button onClick={() => setIsCreateOpen(true)}>
					<Plus />
					Create API Key
				</Button>
			</DashboardHeader>

			<div className="space-y-6">
				{error && (
					<div className="text-destructive rounded-md bg-destructive/10 p-4">
						Error loading API keys: {error.message}
					</div>
				)}

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Key className="size-5" />
							Your API Keys
						</CardTitle>
						<CardDescription>
							API keys allow external applications to access your data. Keep
							them secure and never share them publicly.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<ApiKeysSkeleton />
						) : apiKeys && apiKeys.length > 0 ? (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Key</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Last Used</TableHead>
										<TableHead>Created</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{apiKeys.map((key) => (
										<TableRow key={key.id}>
											<TableCell className="font-medium">
												{key.name || 'Unnamed Key'}
											</TableCell>
											<TableCell>
												<code className="bg-secondary px-2 py-1 rounded-md text-sm w-fit">
													{key.start}****
												</code>
											</TableCell>
											<TableCell>
												<ApiKeyStatus apiKey={key} />
											</TableCell>
											<TableCell>
												{key.lastRequest
													? formatDistanceToNow(new Date(key.lastRequest), {
															addSuffix: true,
														})
													: 'Never'}
											</TableCell>
											<TableCell>
												{formatDistanceToNow(new Date(key.createdAt), {
													addSuffix: true,
												})}
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-2">
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger asChild>
																<Button variant="outline" size="icon" asChild>
																	<Link
																		to="/api-keys/$keyId"
																		params={{ keyId: key.id }}
																	>
																		<Settings className="size-4" />
																	</Link>
																</Button>
															</TooltipTrigger>
															<TooltipContent>Edit API Key</TooltipContent>
														</Tooltip>
													</TooltipProvider>
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger asChild>
																<Button
																	variant="outline"
																	size="icon"
																	onClick={() => setDeleteKey(key)}
																>
																	<Trash2 className="size-4 text-destructive" />
																</Button>
															</TooltipTrigger>
															<TooltipContent>Delete API Key</TooltipContent>
														</Tooltip>
													</TooltipProvider>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						) : (
							<EmptyState onCreateClick={() => setIsCreateOpen(true)} />
						)}
					</CardContent>
				</Card>
			</div>

			{/* Create Dialog */}
			<ApiKeyCreate isOpen={isCreateOpen} onOpenChange={setIsCreateOpen} />

			{/* Delete Dialog */}
			<ApiKeyDelete
				apiKey={deleteKey}
				isOpen={!!deleteKey}
				onOpenChange={(open) => !open && setDeleteKey(null)}
			/>
		</>
	);
}

function ApiKeyStatus({ apiKey }: { apiKey: ApiKey }) {
	if (!apiKey.enabled) {
		return <Badge variant="secondary">Disabled</Badge>;
	}

	if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
		return <Badge variant="destructive">Expired</Badge>;
	}

	return <Badge variant="default">Active</Badge>;
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
	return (
		<div className="flex flex-col items-center justify-center py-12 text-center">
			<Key className="size-12 text-muted-foreground mb-4" />
			<h3 className="text-lg font-semibold mb-2">No API Keys</h3>
			<p className="text-muted-foreground mb-4 max-w-sm">
				Create an API key to allow external applications to access your data
				securely.
			</p>
			<Button onClick={onCreateClick}>
				<Plus />
				Create Your First API Key
			</Button>
		</div>
	);
}

function ApiKeysSkeleton() {
	return (
		<div className="space-y-4">
			{['skeleton-1', 'skeleton-2', 'skeleton-3'].map((id) => (
				<div key={id} className="flex items-center gap-4">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-6 w-16" />
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-8 w-20 ml-auto" />
				</div>
			))}
		</div>
	);
}
