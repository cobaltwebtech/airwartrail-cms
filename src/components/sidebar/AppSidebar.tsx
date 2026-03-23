import { Link } from '@tanstack/react-router';
import {
	CirclePlus,
	FilePlus,
	FilePlusCorner,
	Files,
	FileText,
	GalleryHorizontalEnd,
	Images,
	KeyRound,
	LibraryBig,
	ListVideo,
	NotebookPen,
	Tags,
	Upload,
	Users,
} from 'lucide-react';
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
	// Build navigation with dynamic library subitems including playlists link
	const navMain = [
		{
			title: 'Upload Video',
			url: '/upload',
			icon: Upload,
		},
		{
			title: 'Video Libraries',
			url: '/libraries',
			icon: LibraryBig,
		},
		{
			title: 'Video Playlists',
			url: '/playlists',
			icon: ListVideo,
		},
		{
			title: 'Video Tags',
			url: '/tags',
			icon: Tags,
		},
		{
			title: 'Images',
			url: '/images',
			icon: Images,
		},
		{
			title: 'Image Albums',
			url: '/images/albums',
			icon: GalleryHorizontalEnd,
		},
		{
			title: 'Documents',
			url: '/documents',
			icon: Files,
		},
		{
			title: 'Blog Posts',
			url: '/blog-posts',
			icon: NotebookPen,
		},
		{
			title: 'Create Blog Post',
			url: '/blog-posts/create-post',
			icon: FilePlus,
		},
		{
			title: 'Updates List',
			url: '/pages',
			icon: FileText,
		},
		{
			title: 'Create Update',
			url: '/pages/create-page',
			icon: FilePlusCorner,
		},
		{
			title: 'Create Library',
			url: '/library/create-library',
			icon: CirclePlus,
		},
		{
			title: 'AWT Users',
			url: '/frontend-users',
			icon: Users,
		},
		{
			title: 'API Keys',
			url: '/api-keys',
			icon: KeyRound,
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
