import { createFileRoute, Link } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
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
import { signUp } from '@/lib/auth-client';
import { signupSchema } from '@/lib/schemas';

export const Route = createFileRoute('/auth/signup')({
	validateSearch: (search: Record<string, unknown>) => {
		return {
			redirect: (search.redirect as string) || undefined,
		};
	},
	beforeLoad: async ({ search }) => {
		// Prevent logged-in users from accessing signup page
		await requireNoSession(search.redirect);
	},
	component: SignupPage,
});

function SignupPage() {
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setErrors({});

		// Validate with Zod schema
		const result = signupSchema.safeParse({
			firstName,
			lastName,
			email,
			password,
		});

		if (!result.success) {
			const fieldErrors: Record<string, string> = {};
			for (const issue of result.error.issues) {
				const field = issue.path[0] as string;
				fieldErrors[field] = issue.message;
			}
			setErrors(fieldErrors);
			return;
		}

		setIsLoading(true);

		try {
			await signUp.email({
				name: `${firstName} ${lastName}`,
				email,
				password,
				callbackURL: '/',
				fetchOptions: {
					onError(context) {
						setErrors({ form: context.error.message });
						toast.error(context.error.message);
					},
					onSuccess() {
						toast.success('Account created successfully!');
						window.location.href = '/';
					},
				},
			});
		} catch (error) {
			console.error('Sign up failed:', error);
			const errorMsg =
				error instanceof Error
					? error.message
					: 'Failed to sign up. Please try again.';
			setErrors({ form: errorMsg });
			toast.error(errorMsg);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="bg-background flex min-h-screen items-center justify-center p-6 md:p-10">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle className="text-lg md:text-xl">Sign Up</CardTitle>
					<CardDescription className="text-xs md:text-sm">
						Enter your information to create an account
					</CardDescription>
				</CardHeader>
				<CardContent>
					{errors.form && (
						<div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
							{errors.form}
						</div>
					)}
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="firstName">First Name</Label>
								<Input
									id="firstName"
									placeholder="First Name"
									value={firstName}
									onChange={(e) => setFirstName(e.target.value)}
									disabled={isLoading}
									autoComplete="given-name"
								/>
								{errors.firstName && (
									<p className="text-destructive text-xs">{errors.firstName}</p>
								)}
							</div>
							<div className="grid gap-2">
								<Label htmlFor="lastName">Last Name</Label>
								<Input
									id="lastName"
									placeholder="Last Name"
									value={lastName}
									onChange={(e) => setLastName(e.target.value)}
									disabled={isLoading}
									autoComplete="family-name"
								/>
								{errors.lastName && (
									<p className="text-destructive text-xs">{errors.lastName}</p>
								)}
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								placeholder="m@example.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								disabled={isLoading}
								autoComplete="email"
							/>
							{errors.email && (
								<p className="text-destructive text-xs">{errors.email}</p>
							)}
						</div>

						<div className="grid gap-2">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								type="password"
								placeholder="Password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								disabled={isLoading}
								autoComplete="new-password"
							/>
							{errors.password && (
								<p className="text-destructive text-xs">{errors.password}</p>
							)}
							<p className="text-xs text-muted-foreground">
								Must be at least 8 characters with uppercase, lowercase, and a
								number
							</p>
						</div>

						<Button type="submit" className="w-full" disabled={isLoading}>
							{isLoading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Signing Up...
								</>
							) : (
								'Sign Up'
							)}
						</Button>
					</form>
				</CardContent>
				<CardFooter className="flex justify-center">
					<p className="text-center text-sm">
						Already have an account?{' '}
						<Link
							to="/auth/login"
							search={{ redirect: undefined, error: undefined }}
							className="underline underline-offset-4 hover:text-primary"
						>
							Login Here
						</Link>
					</p>
				</CardFooter>
			</Card>
			<Toaster richColors position="top-right" />
		</div>
	);
}
