import { Link, useLocation } from '@tanstack/react-router';
import { Key, LibraryBig, Plus, Tags, Upload } from 'lucide-react';
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const location = useLocation();

	// Check if we're on a library page
	const isOnLibraryPage = location.pathname.startsWith('/library/');

	// Build navigation with hardcoded library subitems
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
			items: [
				{
					title: 'Premium Library',
					url: '/library/WM2OkZia/videos',
					items: [
						{
							title: 'Playlists',
							url: '/library/WM2OkZia/playlists',
						},
					],
				},
				{
					title: 'Free Library',
					url: '/library/pnr6CRTe/videos',
					items: [
						{
							title: 'Playlists',
							url: '/library/pnr6CRTe/playlists',
						},
					],
				},
			],
		},
		{
			title: 'Video Tags',
			url: '/tags',
			icon: Tags,
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
