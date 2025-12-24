import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/LoginForm";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	return (
		<div className="bg-background flex min-h-screen items-center justify-center">
			<div className="w-full max-w-md">
				<LoginForm />
			</div>
			<Toaster richColors position="top-right" />
		</div>
	);
}
