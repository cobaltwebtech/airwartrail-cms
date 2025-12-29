import { Link, useLocation } from '@tanstack/react-router';
import { Film, FolderOpen, LogOut, Pencil } from 'lucide-react';
import { signOut, useSession } from '@/lib/auth-client';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './ui/button';
import { VideoUpload } from './videos/VideoUpload';

export function DashboardNav() {
	const { data: session, isPending: loading } = useSession();
	const location = useLocation();

	const navItems = [
		{ title: 'Videos', href: '/videos', icon: Film },
		{ title: 'Collections', href: '/collections', icon: FolderOpen },
	] as const;

	return (
		<div className="bg-muted row-span-2 flex h-full flex-col border-r">
			<div className="sticky top-0">
				<div className="flex h-14 items-center justify-center border-b px-4 lg:h-15 lg:px-6">
					<Link to="/">
						<h1 className="text-center font-semibold">Air War Trail</h1>
					</Link>
				</div>
				<div className="flex flex-col gap-4 border-b p-4">
					<VideoUpload />
				</div>
				<div className="flex-1 overflow-auto py-2">
					<nav className="grid items-start gap-2 px-2 text-sm font-medium">
						{navItems.map((item) => {
							const Icon = item.icon;
							const isActive = location.pathname.startsWith(item.href);
							return (
								<Link
									key={item.href}
									to={item.href}
									className={`group hover:bg-sidebar-accent flex items-center rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-sidebar-accent' : 'transparent'}`}
								>
									<Icon className="mr-2 h-4 w-4" />
									<span>{item.title}</span>
								</Link>
							);
						})}
					</nav>
				</div>
				<div className="flex flex-col gap-2 border-y p-4">
					{loading ? (
						<p className="text-muted-foreground text-sm">
							Loading user data...
						</p>
					) : session?.user ? (
						<>
							<p className="font-medium">{session.user.name || 'User'}</p>
							<p className="text-muted-foreground text-sm">
								{session.user.email}
							</p>
						</>
					) : (
						<p className="text-muted-foreground text-sm">Not signed in</p>
					)}
					{session?.user && (
						<Button asChild variant="link" className="justify-start">
							<Link to="/user/$userId" params={{ userId: session.user.id }}>
								<Pencil className="mr-2 size-4" />
								Edit Profile
							</Link>
						</Button>
					)}
					<Button
						variant="secondary"
						onClick={async () => {
							await signOut();
							window.location.href = '/auth/login';
						}}
						className="w-full justify-start"
					>
						<LogOut className="mr-2 size-4" />
						Log Out
					</Button>
				</div>
				<div className="flex flex-col gap-4 p-4">
					<ThemeToggle />
				</div>
			</div>
		</div>
	);
}
