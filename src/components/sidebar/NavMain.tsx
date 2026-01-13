import { Link, useLocation } from '@tanstack/react-router';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from '@/components/ui/sidebar';

type NavItem = {
	title: string;
	url: string;
	icon?: LucideIcon;
	isActive?: boolean;
	items?: NavItem[];
};

// Component for rendering nested submenu items (libraries with playlists)
function SubNavItem({ item, depth = 0 }: { item: NavItem; depth?: number }) {
	const location = useLocation();
	const hasSubItems = item.items && item.items.length > 0;
	const isActive = location.pathname === item.url;

	if (hasSubItems) {
		return (
			<Collapsible asChild defaultOpen={item.isActive} className="group/nested">
				<SidebarMenuSubItem>
					<CollapsibleTrigger asChild>
						<SidebarMenuSubButton isActive={item.isActive || isActive}>
							<Link to={item.url} onClick={(e) => e.stopPropagation()}>
								<span>{item.title}</span>
							</Link>
							<ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/nested:rotate-90" />
						</SidebarMenuSubButton>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<SidebarMenuSub className="ml-2 border-l pl-2">
							{item.items?.map((subItem) => (
								<SubNavItem
									key={subItem.title}
									item={subItem}
									depth={depth + 1}
								/>
							))}
						</SidebarMenuSub>
					</CollapsibleContent>
				</SidebarMenuSubItem>
			</Collapsible>
		);
	}

	return (
		<SidebarMenuSubItem>
			<SidebarMenuSubButton asChild isActive={isActive}>
				<Link to={item.url}>
					<span>{item.title}</span>
				</Link>
			</SidebarMenuSubButton>
		</SidebarMenuSubItem>
	);
}

// Top-level component for rendering main nav items
function NavItemComponent({ item }: { item: NavItem }) {
	const location = useLocation();
	const hasSubItems = item.items && item.items.length > 0;

	if (hasSubItems) {
		return (
			<Collapsible
				asChild
				defaultOpen={item.isActive}
				className="group/collapsible"
			>
				<SidebarMenuItem>
					<CollapsibleTrigger asChild>
						<SidebarMenuButton tooltip={item.title} isActive={item.isActive}>
							{item.icon && <item.icon />}
							<span>{item.title}</span>
							<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
						</SidebarMenuButton>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<SidebarMenuSub>
							{item.items?.map((subItem) => (
								<SubNavItem key={subItem.title} item={subItem} />
							))}
						</SidebarMenuSub>
					</CollapsibleContent>
				</SidebarMenuItem>
			</Collapsible>
		);
	}

	const isActive = location.pathname === item.url;
	return (
		<SidebarMenuItem>
			<SidebarMenuButton tooltip={item.title} isActive={isActive} asChild>
				<Link to={item.url}>
					{item.icon && <item.icon />}
					<span>{item.title}</span>
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

export function NavMain({ items }: { items: NavItem[] }) {
	return (
		<SidebarGroup>
			<SidebarGroupLabel>Navigation</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => (
					<NavItemComponent key={item.title} item={item} />
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
