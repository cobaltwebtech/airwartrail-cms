import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { CheckCircle, Loader2, Lock, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password';
import { Toaster } from '@/components/ui/sonner';
import { requireNoSession } from '@/lib/auth-check';
import { resetPassword } from '@/lib/auth-client';
import { passwordSchema } from '@/lib/schemas';

export const Route = createFileRoute('/auth/reset-password')({
	validateSearch: (search: Record<string, unknown>) => {
		return {
			token: (search.token as string) || undefined,
			error: (search.error as string) || undefined,
		};
	},
	beforeLoad: async () => {
		// Prevent logged-in users from accessing this route
		// They should use account settings to change password
		await requireNoSession('/');
	},
	component: ResetPasswordPage,
});

function ResetPasswordPage() {
	const search = Route.useSearch();
	const router = useRouter();

	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);
	const [error, setError] = useState('');
	const [token, setToken] = useState<string | undefined>(search.token);

	// Error message mapping for Better Auth errors
	const getErrorMessage = useCallback((errorCode: string): string => {
		const errorMessages: Record<string, string> = {
			INVALID_TOKEN:
				'This password reset link has expired or is invalid. Please request a new one.',
			EXPIRED_TOKEN:
				'This password reset link has expired. Please request a new one.',
		};
		return errorMessages[errorCode] || `Reset error: ${errorCode}`;
	}, []);

	// Check for error parameter from Better Auth
	useEffect(() => {
		if (search.error) {
			const message = getErrorMessage(search.error);
			setError(message);
			toast.error(message, {
				description: 'Please request a new password reset link.',
			});
			// Clear the token since it's invalid
			setToken(undefined);
			// Clean up URL by removing error param
			router.navigate({
				to: '/auth/reset-password',
				search: { token: undefined, error: undefined },
				replace: true,
			});
			return;
		}

		// If we have a valid token in the URL, set it
		if (search.token) {
			setToken(search.token);
		}
	}, [search.error, search.token, router, getErrorMessage]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!token) {
			setError('Invalid or missing token');
			toast.error('Invalid or missing token');
			return;
		}

		if (!newPassword || !confirmPassword) {
			setError('Both password fields are required');
			toast.error('Both password fields are required');
			return;
		}

		if (newPassword !== confirmPassword) {
			setError('Passwords do not match');
			toast.error('Passwords do not match');
			return;
		}

		// Validate password using the schema
		try {
			passwordSchema.parse({ password: newPassword });
		} catch (err) {
			if (err instanceof z.ZodError) {
				const errorMessage = err.issues[0].message;
				setError(errorMessage);
				toast.error(errorMessage);
				return;
			}
		}

		setIsLoading(true);
		setError('');

		try {
			await resetPassword({
				newPassword,
				token,
			});
			setIsSuccess(true);
			toast.success('Password has been reset successfully!');
		} catch (err: unknown) {
			console.error('Password reset failed:', err);
			const message =
				err instanceof Error
					? err.message
					: 'Failed to reset password. Please try again or request a new reset link.';
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
							<CheckCircle className="size-8 text-primary-foreground" />
						</div>
						<CardTitle className="text-2xl font-bold">
							Password Reset Successful
						</CardTitle>
						<CardDescription>
							Your password has been reset successfully.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col items-center justify-center gap-4">
						<p className="text-muted-foreground">
							You may now log in with your new password.
						</p>
						<Button asChild className="w-full">
							<Link
								to="/auth/login"
								search={{ redirect: '/', error: undefined }}
							>
								Return to Login
							</Link>
						</Button>
					</CardContent>
				</Card>
				<Toaster richColors position="top-right" />
			</div>
		);
	}

	// Show error state when token is missing or invalid
	if (!token) {
		return (
			<div className="bg-background flex min-h-screen items-center justify-center px-4 py-8">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive">
							<XCircle className="size-8 text-destructive-foreground" />
						</div>
						<CardTitle className="text-2xl font-bold">
							Invalid Reset Link
						</CardTitle>
						<CardDescription>
							The password reset link is invalid or has expired.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-center text-muted-foreground">
							Please request a new password reset link to continue.
						</p>
						<Button asChild className="w-full">
							<Link to="/auth/forgot-password" search={{ redirect: '/' }}>
								Request New Reset Link
							</Link>
						</Button>
					</CardContent>
					<CardFooter className="flex justify-center">
						<div className="text-sm">
							Remember your password?{' '}
							<Link
								to="/auth/login"
								className="underline underline-offset-4 hover:text-primary"
								search={{ redirect: '/', error: undefined }}
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

	// Show password reset form when token is valid
	return (
		<div className="bg-background flex min-h-screen items-center justify-center px-4 py-8">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary">
						<Lock className="size-8 text-primary-foreground" />
					</div>
					<CardTitle className="text-2xl font-bold">
						Reset Your Password
					</CardTitle>
					<CardDescription>Enter your new password below</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="flex flex-col gap-2">
							<Label htmlFor="newPassword">New Password</Label>
							<PasswordInput
								id="newPassword"
								type="password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								disabled={isLoading}
								autoComplete="new-password"
								placeholder="Enter new password"
							/>
							<p className="text-xs text-muted-foreground">
								Must be at least 8 characters with uppercase, lowercase, and a
								number
							</p>
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="confirmPassword">Confirm Password</Label>
							<PasswordInput
								id="confirmPassword"
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								disabled={isLoading}
								autoComplete="new-password"
								placeholder="Confirm new password"
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
							disabled={isLoading || !newPassword || !confirmPassword}
						>
							{isLoading ? (
								<>
									<Loader2 className="mr-2 size-4 animate-spin" />
									Resetting Password...
								</>
							) : (
								<>
									<Lock className="mr-2 size-4" />
									Reset Password
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
							search={{ redirect: '/', error: undefined }}
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
