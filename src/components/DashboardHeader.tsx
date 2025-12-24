import { Link } from '@tanstack/react-router';
import { CircleUserRound } from 'lucide-react';
import type React from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';

interface DashboardHeaderProps {
	heading: string;
	text?: string;
	children?: React.ReactNode;
}

export function DashboardHeader({
	heading,
	text,
	children,
}: DashboardHeaderProps) {
	const { data: session } = useSession();

	return (
		<header className="flex items-center justify-between px-6 py-4">
			<div>
				<h1 className="font-heading text-3xl md:text-4xl">{heading}</h1>
				{text && <p className="text-foreground text-lg font-bold">{text}</p>}
			</div>
			<div>
				{session?.user && (
					<Button asChild>
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
