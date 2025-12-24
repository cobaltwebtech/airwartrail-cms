import { createFileRoute, Link } from '@tanstack/react-router';
import { Files, FolderOpenDot, TvMinimalPlay } from 'lucide-react';
import { DashboardHeader } from '@/components/DashboardHeader';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { requireAuth } from '@/lib/auth-check';

export const Route = createFileRoute('/')({
	beforeLoad: async ({ location }) => {
		// Require authentication for the home page
		const session = await requireAuth(location);
		return { session };
	},
	component: IndexPage,
});

function IndexPage() {
	return (
		<>
			<DashboardHeader
				heading="Digital Asset Management Dashboard"
				text="Digital Asset Management Dashboard"
			/>
			<main className="p-4 lg:p-6 space-y-4">
				<div className="grid gap-8 md:grid-cols-3">
					<Link to="/videos">
						<Card className="hover:bg-secondary col-span-1 h-full text-center transition-colors">
							<CardHeader>
								<TvMinimalPlay className="mx-auto size-12" />
								<CardTitle>Videos</CardTitle>
							</CardHeader>
							<CardContent>
								<CardDescription>
									View and manage all videos in the library.
								</CardDescription>
							</CardContent>
						</Card>
					</Link>
					<Link to="/collections">
						<Card className="hover:bg-secondary col-span-1 h-full text-center transition-colors">
							<CardHeader>
								<FolderOpenDot className="mx-auto size-12" />
								<CardTitle>Collections</CardTitle>
							</CardHeader>
							<CardContent>
								<CardDescription>
									View and manage all collections in the video library.
								</CardDescription>
							</CardContent>
						</Card>
					</Link>
					<Link to="/assets">
						<Card className="hover:bg-secondary col-span-1 h-full text-center transition-colors">
							<CardHeader>
								<Files className="mx-auto size-12" />
								<CardTitle>Other Content</CardTitle>
							</CardHeader>
							<CardContent>
								<CardDescription>
									View and manage other content such as images, zip archives,
									large files, etc.
								</CardDescription>
							</CardContent>
						</Card>
					</Link>
				</div>
			</main>
		</>
	);
}
