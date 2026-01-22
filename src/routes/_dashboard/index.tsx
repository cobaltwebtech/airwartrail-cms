import { createFileRoute, Link } from '@tanstack/react-router';
import {
	CirclePlus,
	KeyRound,
	Library,
	ListVideo,
	Tags,
	Upload,
} from 'lucide-react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAuth } from '@/lib/auth-check';

export const Route = createFileRoute('/_dashboard/')({
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
				heading="Air War Trail Dashboard"
				text="Manage content for the airwartrail.com website."
			></DashboardHeader>
			<section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				<Link to="/upload">
					<Card className="hover:bg-secondary transition-colors h-full">
						<CardHeader className="flex flex-col items-center justify-center gap-2">
							<Upload className="size-10" />
							<CardTitle>Upload Video</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-center text-muted-foreground text-sm">
								Upload a new video
							</p>
						</CardContent>
					</Card>
				</Link>
				<Link to="/libraries">
					<Card className="hover:bg-secondary transition-colors h-full">
						<CardHeader className="flex flex-col items-center justify-center gap-2">
							<Library className="size-10" />
							<CardTitle>Video Libraries</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-center text-muted-foreground text-sm">
								View and manage video libraries
							</p>
						</CardContent>
					</Card>
				</Link>
				<Link to="/playlists">
					<Card className="hover:bg-secondary transition-colors h-full">
						<CardHeader className="flex flex-col items-center justify-center gap-2">
							<ListVideo className="size-10" />
							<CardTitle>Video Playlists</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-center text-muted-foreground text-sm">
								View and manage video playlists
							</p>
						</CardContent>
					</Card>
				</Link>
				<Link to="/tags">
					<Card className="hover:bg-secondary transition-colors h-full">
						<CardHeader className="flex flex-col items-center justify-center gap-2">
							<Tags className="size-10" />
							<CardTitle>Video Tags</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-center text-muted-foreground text-sm">
								View and manage video tags
							</p>
						</CardContent>
					</Card>
				</Link>
				<Link to="/library/create-library">
					<Card className="hover:bg-secondary transition-colors h-full">
						<CardHeader className="flex flex-col items-center justify-center gap-2">
							<CirclePlus className="size-10" />
							<CardTitle>Create Library</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-center text-muted-foreground text-sm">
								Create a new video library
							</p>
						</CardContent>
					</Card>
				</Link>
				<Link to="/api-keys">
					<Card className="hover:bg-secondary transition-colors h-full">
						<CardHeader className="flex flex-col items-center justify-center gap-2">
							<KeyRound className="size-10" />
							<CardTitle>API Keys</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-center text-muted-foreground text-sm">
								Create and manage API keys
							</p>
						</CardContent>
					</Card>
				</Link>
			</section>
		</>
	);
}
