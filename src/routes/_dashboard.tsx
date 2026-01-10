import { createFileRoute, Outlet } from '@tanstack/react-router';
import { DashboardFooter } from '@/components/DashboardFooter';
import { AppSidebar } from '@/components/sidebar/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { requireAuth } from '@/lib/auth-check';

export const Route = createFileRoute('/_dashboard')({
	beforeLoad: async ({ location }) => {
		// Require authentication for all dashboard routes
		const session = await requireAuth(location);
		return { session };
	},
	component: DashboardLayout,
});

function DashboardLayout() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<div className="flex items-center justify-between mx-4 mt-4">
					<SidebarTrigger />
					<ThemeToggle />
				</div>
				<main className="flex flex-1 flex-col px-6 py-4">
					<Outlet />
				</main>
				<DashboardFooter />
			</SidebarInset>
			<Toaster richColors position="top-right" />
		</SidebarProvider>
	);
}
