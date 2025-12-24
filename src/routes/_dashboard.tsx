import { createFileRoute, Outlet } from '@tanstack/react-router';
import { DashboardFooter } from '@/components/DashboardFooter';
import { DashboardNav } from '@/components/DashboardNav';
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
		<div className="bg-background grid min-h-screen w-full md:grid-cols-[200px_1fr]">
			<DashboardNav />
			<div className="min-h-screen flex flex-col">
				<main className="h-full p-4 lg:p-6">
					<Outlet />
				</main>
				<DashboardFooter />
			</div>
			<Toaster richColors position="top-right" />
		</div>
	);
}
