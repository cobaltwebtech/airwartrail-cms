import { createFileRoute } from "@tanstack/react-router";
import { DashboardHeader } from "@/components/DashboardHeader";
import { FileList } from "@/components/r2-assets/FileList";

export const Route = createFileRoute("/_dashboard/assets/")({
	component: AssetsPage,
});

function AssetsPage() {
	return (
		<>
			<DashboardHeader
				heading="Other Content"
				text="Manage other files such as high-res images, zip archives, pdfs, large files, etc."
			/>
			<div className="grid gap-4">
				<FileList />
			</div>
		</>
	);
}
