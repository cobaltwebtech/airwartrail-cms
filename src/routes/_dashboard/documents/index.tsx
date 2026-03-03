import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { Upload } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { DashboardHeader } from '@/components/DashboardHeader';
import { DocumentDelete } from '@/components/documents/DocumentDelete';
import { DocumentInfo } from '@/components/documents/DocumentInfo';
import { DocumentList } from '@/components/documents/DocumentList';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';

type DocumentsSearchParams = {
	page?: number;
	publishStatus?: 'draft' | 'published' | 'archived';
};

export const Route = createFileRoute('/_dashboard/documents/')({
	component: DocumentsPage,
	validateSearch: (search: Record<string, unknown>): DocumentsSearchParams => {
		return {
			page: Number(search?.page) || 1,
			publishStatus: search?.publishStatus as
				| 'draft'
				| 'published'
				| 'archived'
				| undefined,
		};
	},
	loaderDeps: ({ search: { page, publishStatus } }) => ({
		page,
		publishStatus,
	}),
	loader: async ({
		context: { queryClient },
		deps: { page, publishStatus },
	}) => {
		await queryClient.ensureQueryData(
			trpc.documents.list.queryOptions({
				limit: 50,
				page: page || 1,
				sortOrder: 'desc',
				publishStatus,
			}),
		);
		return { page, publishStatus };
	},
});

function DocumentsPage() {
	const { page, publishStatus } = useSearch({ from: '/_dashboard/documents/' });
	const currentPage = page || 1;
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();

	const [deleteDocumentId, setDeleteDocumentId] = useState<string | null>(null);
	const [editDescriptionId, setEditDescriptionId] = useState<string | null>(
		null,
	);

	const {
		data: documentsData,
		isLoading,
		error,
	} = useQuery(
		trpc.documents.list.queryOptions({
			limit: 50,
			page: currentPage,
			sortOrder: 'desc',
			publishStatus,
		}),
	);

	const updateStatusMutation = useMutation(
		trpc.documents.update.mutationOptions({
			onSuccess: () => {
				toast.success('Document status updated');
				queryClient.invalidateQueries(
					trpc.documents.list.queryOptions({
						limit: 50,
						page: currentPage,
						sortOrder: 'desc',
						publishStatus,
					}),
				);
			},
			onError: (error) => {
				toast.error(`Failed to update status: ${error.message}`);
			},
		}),
	);

	const handleStatusChange = useCallback(
		(docId: string, status: 'draft' | 'published' | 'archived') => {
			updateStatusMutation.mutate({ id: docId, publishStatus: status });
		},
		[updateStatusMutation],
	);

	const handlePageChange = (newPage: number) => {
		navigate({
			search: { page: newPage, publishStatus },
		});
	};

	const handleStatusFilterChange = (
		status: 'draft' | 'published' | 'archived' | 'all',
	) => {
		navigate({
			search: {
				page: 1,
				publishStatus: status === 'all' ? undefined : status,
			},
		});
	};

	if (error) {
		return (
			<div className="text-destructive">
				Error loading documents: {error.message}
			</div>
		);
	}

	return (
		<>
			<DashboardHeader heading="Documents" text="Manage your document library">
				<div className="flex justify-end">
					<Button asChild>
						<Link to="/documents/upload">
							<Upload />
							Upload Document
						</Link>
					</Button>
				</div>
			</DashboardHeader>

			<div className="mb-4 flex gap-2">
				<Button
					variant={publishStatus === undefined ? 'default' : 'outline'}
					size="sm"
					onClick={() => handleStatusFilterChange('all')}
				>
					All
				</Button>
				<Button
					variant={publishStatus === 'published' ? 'default' : 'outline'}
					size="sm"
					onClick={() => handleStatusFilterChange('published')}
				>
					Published
				</Button>
				<Button
					variant={publishStatus === 'draft' ? 'default' : 'outline'}
					size="sm"
					onClick={() => handleStatusFilterChange('draft')}
				>
					Draft
				</Button>
				<Button
					variant={publishStatus === 'archived' ? 'default' : 'outline'}
					size="sm"
					onClick={() => handleStatusFilterChange('archived')}
				>
					Archived
				</Button>
			</div>

			<section className="my-4">
				{isLoading ? (
					<div className="text-muted-foreground">Loading documents...</div>
				) : (
					<DocumentList
						documents={documentsData?.documents}
						onPageChange={handlePageChange}
						currentPage={currentPage}
						totalPages={documentsData?.pagination.totalPages || 1}
						total={documentsData?.pagination.total || 0}
						onStatusChange={handleStatusChange}
						onDelete={(id) => setDeleteDocumentId(id)}
						onEditDescription={(id) => setEditDescriptionId(id)}
					/>
				)}
			</section>

			{deleteDocumentId && (
				<DocumentDelete
					documentId={deleteDocumentId}
					onClose={() => setDeleteDocumentId(null)}
					onSuccess={() => {
						setDeleteDocumentId(null);
						queryClient.invalidateQueries(
							trpc.documents.list.queryOptions({
								limit: 50,
								page: currentPage,
								sortOrder: 'desc',
								publishStatus,
							}),
						);
					}}
				/>
			)}

			{editDescriptionId && (
				<DocumentInfo
					documentId={editDescriptionId}
					documentName={
						documentsData?.documents?.find((d) => d.id === editDescriptionId)
							?.name || ''
					}
					currentDescription={
						documentsData?.documents?.find((d) => d.id === editDescriptionId)
							?.description || null
					}
					onClose={() => setEditDescriptionId(null)}
					onSuccess={() => {
						setEditDescriptionId(null);
						queryClient.invalidateQueries(
							trpc.documents.list.queryOptions({
								limit: 50,
								page: currentPage,
								sortOrder: 'desc',
								publishStatus,
							}),
						);
					}}
				/>
			)}
		</>
	);
}
