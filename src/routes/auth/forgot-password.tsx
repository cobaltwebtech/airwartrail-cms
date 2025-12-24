import { createFileRoute, Link } from '@tanstack/react-router';
import { Loader2, Mail } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toaster } from '@/components/ui/sonner';
import { requireNoSession } from '@/lib/auth-check';
import { requestPasswordReset } from '@/lib/auth-client';

export const Route = createFileRoute('/auth/forgot-password')({
	validateSearch: (search: Record<string, unknown>) => {
		return {
			redirect: (search.redirect as string) || undefined,
		};
	},
	beforeLoad: async ({ search }) => {
		// Prevent logged-in users from accessing this route
		await requireNoSession(search.redirect);
	},
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const [email, setEmail] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);
	const [error, setError] = useState('');
	const emailInputId = useId();
	const search = Route.useSearch();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!email) {
			setError('Email is required');
			toast.error('Email is required');
			return;
		}

		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			setError('Please enter a valid email address');
			toast.error('Please enter a valid email address');
			return;
		}

		setIsLoading(true);
		setError('');

		try {
			await requestPasswordReset({
				email,
				redirectTo: '/auth/reset-password',
			});
			setIsSuccess(true);
			toast.success('Password reset link sent to your email!');
		} catch (err: unknown) {
			console.error('Password reset request failed:', err);
			const message =
				err instanceof Error
					? err.message
					: 'Failed to process password reset request. Please try again.';
			setError(message);
			toast.error(message);
		} finally {
			setIsLoading(false);
		}
	};

	if (isSuccess) {
		return (
			<div className="bg-background flex min-h-screen items-center justify-center px-4 py-8">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary">
							<Mail className="size-8 text-primary-foreground" />
						</div>
						<CardTitle className="text-2xl font-bold">
							Check Your Email
						</CardTitle>
						<CardDescription className="space-y-1">
							<p>We have emailed a password reset link to:</p>
							<p className="font-semibold">{email}</p>
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-center text-muted-foreground">
							Click the link in your email to reset your password. The link will
							expire in 15 minutes.
						</p>
						<Button
							variant="secondary"
							onClick={() => {
								setIsSuccess(false);
								setEmail('');
								setError('');
							}}
							className="w-full"
						>
							← Try Another Email
						</Button>
					</CardContent>
					<CardFooter className="flex justify-center">
						<div className="text-sm">
							Remember your password?{' '}
							<Link
								to="/auth/login"
								className="underline underline-offset-4 hover:text-primary"
								search={{ redirect: search.redirect, error: undefined }}
							>
								Back to Login
							</Link>
						</div>
					</CardFooter>
				</Card>
				<Toaster richColors position="top-right" />
			</div>
		);
	}

	return (
		<div className="bg-background flex min-h-screen items-center justify-center px-4 py-8">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl font-bold">
						Forgot Your Password
					</CardTitle>
					<CardDescription>
						Enter your email address and we'll send you a link to reset your
						password
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="flex flex-col gap-2">
							<Label htmlFor={emailInputId}>Email</Label>
							<Input
								id={emailInputId}
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="Enter your email address"
								className="w-full"
								required
								disabled={isLoading}
								autoComplete="email"
							/>
						</div>

						{error && (
							<div className="text-sm font-medium text-destructive">
								{error}
							</div>
						)}

						<Button
							type="submit"
							className="w-full"
							disabled={isLoading || !email}
						>
							{isLoading ? (
								<>
									<Loader2 className="mr-2 size-4 animate-spin" />
									Sending Reset Link...
								</>
							) : (
								<>
									<Mail className="mr-2 size-4" />
									Send Reset Link
								</>
							)}
						</Button>
					</form>
				</CardContent>
				<CardFooter className="flex justify-center">
					<div className="text-sm">
						Remember your password?{' '}
						<Link
							to="/auth/login"
							className="underline underline-offset-4 hover:text-primary"
							search={{ redirect: search.redirect, error: undefined }}
						>
							Back to Login
						</Link>
					</div>
				</CardFooter>
			</Card>
			<Toaster richColors position="top-right" />
		</div>
	);
}
