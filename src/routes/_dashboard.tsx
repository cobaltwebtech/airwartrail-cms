import { createFileRoute, Outlet } from '@tanstack/react-router';
import { DashboardFooter } from '@/components/DashboardFooter';
import { DashboardNav } from '@/components/DashboardNav';
import { Toaster } from '@/components/ui/sonner';

export const Route = createFileRoute('/_dashboard')({
	component: DashboardLayout,
});

function DashboardLayout() {
	return (
		<div className="bg-background grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
			<DashboardNav />
			<div className="min-h-screen flex flex-col">
				<main className="p-4 lg:p-6">
					<Outlet />
				</main>
				<DashboardFooter />
			</div>
			<Toaster richColors position="top-right" />
		</div>
	);
}
