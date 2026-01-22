import { Badge } from '@/components/ui/badge';
import pkg from '../../package.json';

const appVersion: string = pkg.version;

export function DashboardFooter() {
	return (
		<footer className="bg-muted w-full col-start-2 flex items-center justify-between gap-2 border-t p-2 md:gap-6 md:p-4">
			<div>
				<h6 className="font-heading content-end text-lg/5">
					&copy;{new Date().getFullYear()} Air War Trail
				</h6>
				<p className="text-muted-foreground content-end text-sm">
					Custom digital asset management dashboard built by{' '}
					<a
						href="https://www.cobaltweb.tech/"
						className="text-accent font-semibold"
					>
						Cobalt Web Technologies
					</a>
				</p>
			</div>
			<div className="text-sm text-muted-foreground">
				Current Version <Badge>v{appVersion}</Badge>
			</div>
		</footer>
	);
}
