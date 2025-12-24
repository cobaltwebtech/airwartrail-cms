import { createFileRoute } from "@tanstack/react-router";
import { DashboardHeader } from "@/components/DashboardHeader";
import { UserCard } from "@/components/UserCard";

export const Route = createFileRoute("/_dashboard/user/$userId")({
	component: UserProfilePage,
});

function UserProfilePage() {
	return (
		<>
			<DashboardHeader
				heading="User Info"
				text="Manage your credentials and info."
			/>
			<UserCard />
		</>
	);
}
