import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from '@tanstack/react-router';
import { Key, LibraryBig, Plus, Upload } from 'lucide-react';
import { Logo } from '@/components/sidebar/Logo';
import { NavMain } from '@/components/sidebar/NavMain';
import { NavUser } from '@/components/sidebar/NavUser';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from '@/components/ui/sidebar';
import { trpc } from '@/lib/trpc';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { data: libraries, isLoading: librariesLoading } = useQuery(
		trpc.mux.listLibraries.queryOptions(),
	);
	const location = useLocation();

	// Check if we're on a library page (any route starting with /library/[id])
	const isOnLibraryPage =
		location.pathname.startsWith('/library/') &&
		location.pathname.includes('/videos');

	// Build navigation with dynamic library subitems including playlists link
	const navMain = [
		{
			title: 'Upload Video',
			url: '/upload',
			icon: Upload,
		},
		{
			title: 'Create Library',
			url: '/library/create-library',
			icon: Plus,
		},
		{
			title: 'Video Libraries',
			url: '/',
			icon: LibraryBig,
			isActive: isOnLibraryPage || location.pathname === '/',
			items: librariesLoading
				? []
				: (libraries?.map((library) => ({
						title: library.name,
						url: `/library/${library.id}/videos`,
						isActive: location.pathname.startsWith(`/library/${library.id}`),
						items: [
							{
								title: 'Playlists',
								url: `/library/${library.id}/playlists`,
							},
						],
					})) ?? []),
		},
		{
			title: 'API Keys',
			url: '/api-keys',
			icon: Key,
		},
	];

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<Link to="/">
								<Logo className="size-8" />
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">Air War Trail</span>
									<span className="truncate text-xs">Dashboard</span>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={navMain} />
			</SidebarContent>
			<SidebarFooter>
				<NavUser />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
