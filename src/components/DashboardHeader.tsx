import { Link } from '@tanstack/react-router';
import { CircleUserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';

export function DashboardHeader(props: {
	heading: string;
	text?: string;
	children?: React.ReactNode;
}) {
	const { data: session } = useSession();
	const { heading, text, children } = props;

	// Don't render if no heading is set
	if (!heading) return null;

	return (
		<header className="space-y-2 mb-4">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-bold text-3xl md:text-4xl">{heading}</h1>
					{text && (
						<p className="text-foreground text-lg font-semibold">{text}</p>
					)}
				</div>
				{session?.user && (
					<Button asChild variant="secondary">
						<Link to="/user/$userId" params={{ userId: session.user.id }}>
							<CircleUserRound /> Account
						</Link>
					</Button>
				)}
			</div>
			{children}
		</header>
	);
}
