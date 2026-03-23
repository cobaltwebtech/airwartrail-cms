import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import {
	ArrowUpDown,
	BadgeCheck,
	BadgeQuestionMark,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
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

const PAGE_SIZE = 50;

export const Route = createFileRoute('/_dashboard/frontend-users/')({
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData(
			trpc.frontendAuth.listUsers.queryOptions({
				limit: PAGE_SIZE,
				page: 1,
				sortBy: 'createdAt',
				sortOrder: 'desc',
			}),
		);
	},
	component: FrontendUsersPage,
});

type SortBy = 'createdAt' | 'updatedAt' | 'name' | 'email';

interface FrontendUser {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	createdAt: Date;
	updatedAt: Date;
	role: string | null;
	banned: boolean | null;
	banReason: string | null;
	banExpires: Date | null;
	lastActiveAt: Date | null;
	stripeCustomerId: string | null;
	subscriptionStatus: string | null;
	subscriptionPlan: string | null;
}

function FrontendUsersPage() {
	const [page, setPage] = useState(1);
	const [searchTerm, setSearchTerm] = useState('');
	const [sortBy, setSortBy] = useState<SortBy>('createdAt');
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
	const [subscriptionFilter, setSubscriptionFilter] = useState<
		'all' | 'active' | 'canceled' | 'none'
	>('all');

	const {
		data: usersData,
		isLoading,
		error,
		isPlaceholderData,
	} = useQuery({
		...trpc.frontendAuth.listUsers.queryOptions({
			limit: PAGE_SIZE,
			page,
			sortBy,
			sortOrder,
			search: searchTerm || undefined,
			subscriptionFilter:
				subscriptionFilter === 'all' ? undefined : subscriptionFilter,
		}),
		placeholderData: keepPreviousData,
	});

	const users = (usersData?.users ?? []) as FrontendUser[];
	const pagination = usersData?.pagination;

	const columns = useMemo<ColumnDef<FrontendUser>[]>(
		() => [
			{
				accessorKey: 'name',
				header: () => (
					<Button
						variant="ghost"
						onClick={() => {
							if (sortBy === 'name') {
								setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
							} else {
								setSortBy('name');
								setSortOrder('asc');
							}
							setPage(1);
						}}
					>
						Name
						<ArrowUpDown className="size-4" />
					</Button>
				),
				cell: ({ row }) => (
					<Link
						to="/frontend-users/$userId"
						params={{ userId: row.original.id }}
						className="px-4 font-medium hover:underline"
					>
						{row.original.name}
					</Link>
				),
			},
			{
				accessorKey: 'email',
				header: () => (
					<Button
						variant="ghost"
						onClick={() => {
							if (sortBy === 'email') {
								setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
							} else {
								setSortBy('email');
								setSortOrder('asc');
							}
							setPage(1);
						}}
					>
						Email
						<ArrowUpDown className="size-4" />
					</Button>
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground text-sm">
						{row.original.email}
					</span>
				),
			},
			{
				accessorKey: 'subscriptionStatus',
				header: 'Subscription',
				cell: ({ row }) => {
					const status = row.original.subscriptionStatus;
					if (status === 'active') {
						return (
							<Badge variant="accent" className="capitalize">
								{row.original.subscriptionPlan ?? 'Active'}
							</Badge>
						);
					}
					if (status === 'canceled') {
						return <Badge variant="destructive">Canceled</Badge>;
					}
					return <span className="text-muted-foreground text-sm">None</span>;
				},
			},
			{
				accessorKey: 'emailVerified',
				header: 'Verified',
				cell: ({ row }) =>
					row.original.emailVerified ? (
						<BadgeCheck className="text-accent size-4" />
					) : (
						<BadgeQuestionMark className="text-muted-foreground size-4" />
					),
			},
			{
				accessorKey: 'createdAt',
				header: () => (
					<Button
						variant="ghost"
						onClick={() => {
							if (sortBy === 'createdAt') {
								setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
							} else {
								setSortBy('createdAt');
								setSortOrder('desc');
							}
							setPage(1);
						}}
					>
						Signed Up
						<ArrowUpDown className="size-4" />
					</Button>
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground text-sm">
						{new Date(row.original.createdAt).toLocaleDateString('en-US', {
							year: 'numeric',
							month: 'short',
							day: 'numeric',
						})}
					</span>
				),
			},
			{
				accessorKey: 'lastActiveAt',
				header: 'Last Active',
				cell: ({ row }) => (
					<span className="text-muted-foreground text-sm">
						{row.original.lastActiveAt
							? new Date(row.original.lastActiveAt).toLocaleDateString(
									'en-US',
									{
										year: 'numeric',
										month: 'short',
										day: 'numeric',
									},
								)
							: '—'}
					</span>
				),
			},
		],
		[sortBy],
	);

	const table = useReactTable({
		data: users,
		columns,
		getCoreRowModel: getCoreRowModel(),
		manualPagination: true,
		pageCount: pagination?.totalPages ?? -1,
	});

	if (error) {
		return (
			<div className="text-destructive">
				Error loading users: {error.message}
			</div>
		);
	}

	return (
		<>
			<DashboardHeader
				heading="Frontend Users"
				text="View registered users from the frontend application."
			/>

			<section className="space-y-4">
				<div className="flex justify-between gap-2">
					<Input
						placeholder="Search by name or email..."
						value={searchTerm}
						onChange={(e) => {
							setSearchTerm(e.target.value);
							setPage(1);
						}}
						className="max-w-sm"
					/>
					<div className="flex gap-2">
						<Select
							value={subscriptionFilter}
							onValueChange={(value) => {
								setSubscriptionFilter(
									value as 'all' | 'active' | 'canceled' | 'none',
								);
								setPage(1);
							}}
						>
							<SelectTrigger className="w-45">
								<SelectValue placeholder="Subscription" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Users</SelectItem>
								<SelectItem value="active">Subscribed</SelectItem>
								<SelectItem value="canceled">Canceled</SelectItem>
								<SelectItem value="none">Not Subscribed</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={sortBy}
							onValueChange={(value) => {
								setSortBy(value as SortBy);
								setPage(1);
							}}
						>
							<SelectTrigger className="w-45">
								<SelectValue placeholder="Sort by" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="createdAt">Sign Up Date</SelectItem>
								<SelectItem value="updatedAt">Last Updated</SelectItem>
								<SelectItem value="name">Name</SelectItem>
								<SelectItem value="email">Email</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				{isLoading ? (
					<UsersTableSkeleton />
				) : users.length === 0 && !searchTerm ? (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<Users className="size-12 text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold">No Users Yet</h3>
						<p className="text-muted-foreground mb-4 max-w-sm">
							No users have signed up for the frontend application yet.
						</p>
					</div>
				) : (
					<div
						className={`rounded-md border ${isPlaceholderData ? 'opacity-60' : ''}`}
					>
						<Table>
							<TableHeader>
								{table.getHeaderGroups().map((headerGroup) => (
									<TableRow key={headerGroup.id}>
										{headerGroup.headers.map((header) => (
											<TableHead key={header.id}>
												{header.isPlaceholder
													? null
													: flexRender(
															header.column.columnDef.header,
															header.getContext(),
														)}
											</TableHead>
										))}
									</TableRow>
								))}
							</TableHeader>
							<TableBody>
								{table.getRowModel().rows.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={columns.length}
											className="h-24 text-center"
										>
											No users found.
										</TableCell>
									</TableRow>
								) : (
									table.getRowModel().rows.map((row) => (
										<TableRow key={row.id}>
											{row.getVisibleCells().map((cell) => (
												<TableCell key={cell.id}>
													{flexRender(
														cell.column.columnDef.cell,
														cell.getContext(),
													)}
												</TableCell>
											))}
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				)}

				{pagination && pagination.total > 0 && (
					<div className="flex items-center justify-between text-sm text-muted-foreground">
						<span>
							Showing {(page - 1) * PAGE_SIZE + 1}–
							{Math.min(page * PAGE_SIZE, pagination.total)} of{' '}
							{pagination.total} user{pagination.total !== 1 ? 's' : ''}
						</span>
						<div className="flex items-center gap-1">
							<Button
								variant="outline"
								size="icon"
								onClick={() => setPage(1)}
								disabled={!pagination.hasPrevious}
							>
								<ChevronsLeft className="size-4" />
							</Button>
							<Button
								variant="outline"
								size="icon"
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								disabled={!pagination.hasPrevious}
							>
								<ChevronLeft className="size-4" />
							</Button>
							<span className="px-3 font-medium text-foreground">
								Page {page} of {pagination.totalPages}
							</span>
							<Button
								variant="outline"
								size="icon"
								onClick={() =>
									setPage((p) => Math.min(pagination.totalPages, p + 1))
								}
								disabled={!pagination.hasNext}
							>
								<ChevronRight className="size-4" />
							</Button>
							<Button
								variant="outline"
								size="icon"
								onClick={() => setPage(pagination.totalPages)}
								disabled={!pagination.hasNext}
							>
								<ChevronsRight className="size-4" />
							</Button>
						</div>
					</div>
				)}
			</section>
		</>
	);
}

function UsersTableSkeleton() {
	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Email</TableHead>
						<TableHead>Verified</TableHead>
						<TableHead>Signed Up</TableHead>
						<TableHead>Last Active</TableHead>
						<TableHead>Subscription</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{Array.from({ length: 10 }).map((_, i) => (
						<TableRow key={`skeleton-row-${i.toString()}`}>
							<TableCell>
								<Skeleton className="h-4 w-32" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-48" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-5 w-16 rounded-full" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-24" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-24" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-5 w-16 rounded-full" />
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
