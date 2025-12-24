import { createFileRoute } from "@tanstack/react-router";
import { SignupForm } from "@/components/SignupForm";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/signup")({
	component: SignupPage,
});

function SignupPage() {
	return (
		<div className="bg-background flex min-h-screen items-center justify-center">
			<div className="w-full max-w-md">
				<SignupForm />
			</div>
			<Toaster richColors position="top-right" />
		</div>
	);
}
