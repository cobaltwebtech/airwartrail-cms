import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, CreditCard, KeyRound, Monitor, User } from 'lucide-react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Badge } from '@/components/ui/badge';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
} from '@/components/ui/breadcrumb';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_dashboard/frontend-users/$userId')({
	loader: async ({ context: { queryClient }, params: { userId } }) => {
		await queryClient.ensureQueryData(
			trpc.frontendAuth.getUser.queryOptions({ id: userId }),
		);
	},
	component: FrontendUserDetailPage,
});

function formatDate(date: Date | string | null | undefined): string {
	if (!date) return '—';
	return new Date(date).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
}

function FrontendUserDetailPage() {
	const { userId } = Route.useParams();

	const {
		data: userData,
		isLoading,
		error,
	} = useQuery(trpc.frontendAuth.getUser.queryOptions({ id: userId }));

	if (error) {
		return (
			<div className="text-destructive">
				Error loading user: {error.message}
			</div>
		);
	}

	if (isLoading || !userData) {
		return <UserDetailSkeleton />;
	}

	return (
		<>
			<DashboardHeader heading={userData.name} text={userData.email}>
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink asChild>
								<Link to="/frontend-users">
									<ArrowLeft className="inline size-4 mr-1" />
									Back to Users
								</Link>
							</BreadcrumbLink>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</DashboardHeader>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Main content — left 2 columns */}
				<div className="lg:col-span-2 space-y-6">
					{/* User Info Card */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<User className="size-5" />
								User Information
							</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
								<DetailField label="User ID" value={userData.id} mono />
								<DetailField label="Name" value={userData.name} />
								<DetailField label="Email" value={userData.email} />
								<DetailField
									label="Email Verified"
									value={
										userData.emailVerified ? (
											<Badge variant="accent">Verified</Badge>
										) : (
											<Badge variant="secondary">Unverified</Badge>
										)
									}
								/>
								<DetailField
									label="Role"
									value={userData.role ?? 'No role assigned'}
								/>
								<DetailField
									label="Status"
									value={
										userData.banned ? (
											<Badge variant="destructive">Banned</Badge>
										) : (
											<Badge variant="accent">Active</Badge>
										)
									}
								/>
								{userData.banned && (
									<>
										<DetailField
											label="Ban Reason"
											value={userData.banReason ?? 'No reason provided'}
										/>
										<DetailField
											label="Ban Expires"
											value={formatDate(userData.banExpires)}
										/>
									</>
								)}
								<DetailField
									label="Stripe Customer ID"
									value={userData.stripeCustomerId ?? '—'}
									mono
								/>
								<DetailField
									label="Last Active"
									value={formatDate(userData.lastActiveAt)}
								/>
								<DetailField
									label="Signed Up"
									value={formatDate(userData.createdAt)}
								/>
								<DetailField
									label="Last Updated"
									value={formatDate(userData.updatedAt)}
								/>
							</dl>
						</CardContent>
					</Card>

					{/* Subscriptions Card */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<CreditCard className="size-5" />
								Subscriptions
							</CardTitle>
							<CardDescription>
								{userData.subscriptions.length === 0
									? 'No subscriptions found for this user.'
									: `${userData.subscriptions.length} subscription${userData.subscriptions.length !== 1 ? 's' : ''}`}
							</CardDescription>
						</CardHeader>
						{userData.subscriptions.length > 0 && (
							<CardContent>
								<div className="space-y-4">
									{userData.subscriptions.map((sub) => (
										<div key={sub.id}>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
												<DetailField
													label="Subscription ID"
													value={sub.id}
													mono
												/>
												<DetailField label="Plan" value={sub.plan} />
												<DetailField
													label="Status"
													value={
														<SubscriptionStatusBadge status={sub.status} />
													}
												/>
												<DetailField
													label="Billing Interval"
													value={sub.billingInterval ?? '—'}
												/>
												<DetailField
													label="Period Start"
													value={formatDate(sub.periodStart)}
												/>
												<DetailField
													label="Period End"
													value={formatDate(sub.periodEnd)}
												/>
												{sub.trialStart && (
													<DetailField
														label="Trial Start"
														value={formatDate(sub.trialStart)}
													/>
												)}
												{sub.trialEnd && (
													<DetailField
														label="Trial End"
														value={formatDate(sub.trialEnd)}
													/>
												)}
												<DetailField
													label="Cancel at Period End"
													value={sub.cancelAtPeriodEnd ? 'Yes' : 'No'}
												/>
												{sub.canceledAt && (
													<DetailField
														label="Canceled At"
														value={formatDate(sub.canceledAt)}
													/>
												)}
												{sub.endedAt && (
													<DetailField
														label="Ended At"
														value={formatDate(sub.endedAt)}
													/>
												)}
												<DetailField
													label="Stripe Subscription ID"
													value={sub.stripeSubscriptionId ?? '—'}
													mono
												/>
												<DetailField
													label="Stripe Customer ID"
													value={sub.stripeCustomerId ?? '—'}
													mono
												/>
												{sub.seats != null && (
													<DetailField
														label="Seats"
														value={sub.seats.toString()}
													/>
												)}
											</div>
											<Separator className="mt-4" />
										</div>
									))}
								</div>
							</CardContent>
						)}
					</Card>
				</div>

				{/* Sidebar — right 1 column */}
				<div className="space-y-6">
					{/* Sessions Card */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Monitor className="size-5" />
								Sessions
							</CardTitle>
							<CardDescription>
								{userData.sessions.length === 0
									? 'No sessions.'
									: `${userData.sessions.length} session${userData.sessions.length !== 1 ? 's' : ''}`}
							</CardDescription>
						</CardHeader>
						{userData.sessions.length > 0 && (
							<CardContent>
								<div className="rounded-md border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Created</TableHead>
												<TableHead>Expires</TableHead>
												<TableHead>Status</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{userData.sessions.map((sess) => {
												const isExpired = new Date(sess.expiresAt) < new Date();
												return (
													<TableRow key={sess.id}>
														<TableCell className="text-sm">
															{formatDate(sess.createdAt)}
														</TableCell>
														<TableCell className="text-sm">
															{formatDate(sess.expiresAt)}
														</TableCell>
														<TableCell>
															{isExpired ? (
																<Badge variant="secondary">Expired</Badge>
															) : (
																<Badge variant="accent">Active</Badge>
															)}
														</TableCell>
													</TableRow>
												);
											})}
										</TableBody>
									</Table>
								</div>
							</CardContent>
						)}
					</Card>

					{/* Accounts Card */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<KeyRound className="size-5" />
								Linked Accounts
							</CardTitle>
							<CardDescription>
								{userData.accounts.length === 0
									? 'No linked accounts.'
									: `${userData.accounts.length} account${userData.accounts.length !== 1 ? 's' : ''}`}
							</CardDescription>
						</CardHeader>
						{userData.accounts.length > 0 && (
							<CardContent>
								<div className="space-y-3">
									{userData.accounts.map((acct) => (
										<div
											key={acct.id}
											className="rounded-md border p-3 space-y-2"
										>
											<div className="flex items-center justify-between">
												<span className="font-medium capitalize">
													{acct.providerId}
												</span>
												<span className="text-xs text-muted-foreground">
													{formatDate(acct.createdAt)}
												</span>
											</div>
											<p className="text-sm text-muted-foreground font-mono break-all">
												{acct.accountId}
											</p>
											{acct.scope && (
												<p className="text-xs text-muted-foreground">
													Scope: {acct.scope}
												</p>
											)}
										</div>
									))}
								</div>
							</CardContent>
						)}
					</Card>
				</div>
			</div>
		</>
	);
}

// ============================================================================
// Sub-components
// ============================================================================

function DetailField({
	label,
	value,
	mono,
}: {
	label: string;
	value: React.ReactNode;
	mono?: boolean;
}) {
	return (
		<div>
			<dt className="text-sm text-muted-foreground">{label}</dt>
			<dd
				className={`mt-0.5 text-sm font-medium ${mono ? 'font-mono break-all' : ''}`}
			>
				{value}
			</dd>
		</div>
	);
}

function SubscriptionStatusBadge({ status }: { status: string | null }) {
	switch (status) {
		case 'active':
			return <Badge variant="accent">Active</Badge>;
		case 'trialing':
			return <Badge variant="secondary">Trialing</Badge>;
		case 'canceled':
			return <Badge variant="destructive">Canceled</Badge>;
		case 'past_due':
			return <Badge variant="destructive">Past Due</Badge>;
		case 'incomplete':
			return <Badge variant="secondary">Incomplete</Badge>;
		case 'incomplete_expired':
			return <Badge variant="destructive">Expired</Badge>;
		default:
			return <Badge variant="secondary">{status ?? 'Unknown'}</Badge>;
	}
}

function UserDetailSkeleton() {
	return (
		<>
			<div className="space-y-2 mb-4">
				<Skeleton className="h-9 w-48" />
				<Skeleton className="h-5 w-64" />
			</div>
			<div className="grid gap-6 lg:grid-cols-3">
				<div className="lg:col-span-2 space-y-6">
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-40" />
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 gap-4">
								{Array.from({ length: 8 }).map((_, i) => (
									<div key={`info-${i.toString()}`}>
										<Skeleton className="h-4 w-20 mb-1" />
										<Skeleton className="h-5 w-40" />
									</div>
								))}
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-36" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-24 w-full" />
						</CardContent>
					</Card>
				</div>
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-28" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-32 w-full" />
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-36" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-20 w-full" />
						</CardContent>
					</Card>
				</div>
			</div>
		</>
	);
}
