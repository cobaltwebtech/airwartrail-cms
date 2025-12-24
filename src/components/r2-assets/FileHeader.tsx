import { ArrowUp, ArrowDown, Upload, CloudUpload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface FileHeaderProps {
	searchTerm: string;
	setSearchTerm: (term: string) => void;
	sortCriteria: string;
	setSortCriteria: (criteria: string) => void;
	sortDirection: 'asc' | 'desc';
	toggleSortDirection: () => void;
	onUploadClick: () => void;
}

export function FileHeader({
	searchTerm,
	setSearchTerm,
	sortCriteria,
	setSortCriteria,
	sortDirection,
	toggleSortDirection,
	onUploadClick,
}: FileHeaderProps) {
	return (
		<div className="flex justify-between gap-2">
			<Input
				placeholder="Search files..."
				value={searchTerm}
				onChange={(e) => setSearchTerm(e.target.value)}
				className="max-w-sm"
			/>
			<div className="flex gap-x-4">
				<div className="flex items-center gap-2">
					<CloudUpload className="size-6" />
					<span>Drag and drop files here</span>
				</div>
				<Button onClick={onUploadClick}>
					<Upload className="mr-2 h-4 w-4" />
					Upload
				</Button>
				<Select value={sortCriteria} onValueChange={setSortCriteria}>
					<SelectTrigger className="max-w-sm">
						<SelectValue placeholder="Sort by" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="date">Sort by Date</SelectItem>
						<SelectItem value="name">Sort by Name</SelectItem>
						<SelectItem value="size">Sort by Size</SelectItem>
					</SelectContent>
				</Select>
				<Button onClick={toggleSortDirection}>
					{sortDirection === 'asc' ? <ArrowUp /> : <ArrowDown />}
				</Button>
			</div>
		</div>
	);
}
