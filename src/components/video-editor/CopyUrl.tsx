import { Copy } from 'lucide-react';
import type React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { copyVideoUrl } from '@/lib/videoData';

interface CopyUrlProps {
	videoId: string;
}

const CopyUrl: React.FC<CopyUrlProps> = ({ videoId }) => {
	const handleCopy = () => {
		copyVideoUrl(videoId)();
		toast.success('URL copied to clipboard');
	};

	return (
		<Card className="col-span-2 w-full justify-between">
			<CardHeader>
				<CardTitle>Copy Video URL</CardTitle>
				<CardDescription>Click button below to copy the URL.</CardDescription>
			</CardHeader>
			<CardContent>
				<Button onClick={handleCopy}>
					<Copy className="size-4" />
					Copy Video URL
				</Button>
			</CardContent>
		</Card>
	);
};

export default CopyUrl;
