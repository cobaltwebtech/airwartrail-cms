import type { Editor } from '@tiptap/react';
import {
	Bold,
	Code,
	Heading2,
	Heading3,
	Heading4,
	ImagePlus,
	Italic,
	Link,
	List,
	ListOrdered,
	Quote,
	Redo,
	Strikethrough,
	Undo,
} from 'lucide-react';
import { useEffect, useEffectEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import {
	getImageUrl,
	ImagePickerDialog,
	type SelectedImage,
} from './ImagePickerDialog';

interface EditorMenuBarProps {
	editor: Editor;
}

interface MenuButtonProps {
	onClick: () => void;
	isActive?: boolean;
	disabled?: boolean;
	tooltip: string;
	children: React.ReactNode;
}

function MenuButton({
	onClick,
	isActive,
	disabled,
	tooltip,
	children,
}: MenuButtonProps) {
	return (
		<TooltipProvider delayDuration={300}>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant={isActive ? 'secondary' : 'ghost'}
						size="sm"
						onClick={onClick}
						disabled={disabled}
						className="size-8 p-0"
					>
						{children}
					</Button>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					<p>{tooltip}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export function EditorMenuBar({ editor }: EditorMenuBarProps) {
	const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
	const [linkUrl, setLinkUrl] = useState('');
	const [openInNewTab, setOpenInNewTab] = useState(false);
	const [useNofollow, setUseNofollow] = useState(false);
	const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);

	const handleImageSelected = (image: SelectedImage) => {
		// Store base URL without variant in editor content
		// The CustomImage extension will automatically apply thumbnail variant in editor preview
		editor
			.chain()
			.focus()
			.setImage({
				src: image.deliveryUrl,
				alt: image.altText || 'Blog image',
			})
			.run();
		setIsImagePickerOpen(false);
	};

	const handleLinkClick = () => {
		const linkAttrs = editor.getAttributes('link');
		setLinkUrl(linkAttrs.href || '');
		setOpenInNewTab(linkAttrs.target === '_blank');
		setUseNofollow(linkAttrs.rel?.includes('nofollow') ?? false);
		setIsLinkDialogOpen(true);
	};

	// Handle link clicks from the editor
	const handleOpenLinkDialog = useEffectEvent((event: Event) => {
		const customEvent = event as CustomEvent<{ href: string; pos: number }>;
		const linkAttrs = editor.getAttributes('link');
		setLinkUrl(customEvent.detail.href || '');
		setOpenInNewTab(linkAttrs.target === '_blank');
		setUseNofollow(linkAttrs.rel?.includes('nofollow') ?? false);
		setIsLinkDialogOpen(true);
		editor.chain().focus().setTextSelection(customEvent.detail.pos).run();
	});

	// Listen for link clicks from the editor
	useEffect(() => {
		window.addEventListener('openLinkDialog', handleOpenLinkDialog);
		return () =>
			window.removeEventListener('openLinkDialog', handleOpenLinkDialog);
	}, []);

	const handleLinkSave = () => {
		if (linkUrl) {
			const linkAttrs: { href: string; target?: string; rel?: string } = {
				href: linkUrl,
			};

			if (openInNewTab) {
				linkAttrs.target = '_blank';
			}

			if (useNofollow) {
				linkAttrs.rel = 'noopener nofollow';
			}

			editor.chain().focus().extendMarkRange('link').setLink(linkAttrs).run();
		} else {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
		}
		setIsLinkDialogOpen(false);
		setLinkUrl('');
		setOpenInNewTab(false);
		setUseNofollow(false);
	};

	if (!editor) {
		return null;
	}

	return (
		<div className="flex flex-wrap items-center gap-1 border-b border-input bg-background p-2">
			{/* Text formatting */}
			<MenuButton
				onClick={() => editor.chain().focus().toggleBold().run()}
				isActive={editor.isActive('bold')}
				disabled={!editor.can().chain().focus().toggleBold().run()}
				tooltip="Bold (Ctrl+B)"
			>
				<Bold className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().toggleItalic().run()}
				isActive={editor.isActive('italic')}
				disabled={!editor.can().chain().focus().toggleItalic().run()}
				tooltip="Italic (Ctrl+I)"
			>
				<Italic className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().toggleStrike().run()}
				isActive={editor.isActive('strike')}
				disabled={!editor.can().chain().focus().toggleStrike().run()}
				tooltip="Strikethrough"
			>
				<Strikethrough className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().toggleCode().run()}
				isActive={editor.isActive('code')}
				disabled={!editor.can().chain().focus().toggleCode().run()}
				tooltip="Inline Code"
			>
				<Code className="size-4" />
			</MenuButton>

			<Separator orientation="vertical" className="mx-1 h-6" />

			{/* Link */}
			<MenuButton
				onClick={handleLinkClick}
				isActive={editor.isActive('link')}
				tooltip="Add Link"
			>
				<Link className="size-4" />
			</MenuButton>

			{/* Image */}
			<MenuButton
				onClick={() => setIsImagePickerOpen(true)}
				tooltip="Insert Image"
			>
				<ImagePlus className="size-4" />
			</MenuButton>

			<Separator orientation="vertical" className="mx-1 h-6" />
			<MenuButton
				onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
				isActive={editor.isActive('heading', { level: 2 })}
				tooltip="Heading 2"
			>
				<Heading2 className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
				isActive={editor.isActive('heading', { level: 3 })}
				tooltip="Heading 3"
			>
				<Heading3 className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
				isActive={editor.isActive('heading', { level: 4 })}
				tooltip="Heading 4"
			>
				<Heading4 className="size-4" />
			</MenuButton>

			<Separator orientation="vertical" className="mx-1 h-6" />

			{/* Lists */}
			<MenuButton
				onClick={() => editor.chain().focus().toggleBulletList().run()}
				isActive={editor.isActive('bulletList')}
				tooltip="Bullet List"
			>
				<List className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().toggleOrderedList().run()}
				isActive={editor.isActive('orderedList')}
				tooltip="Numbered List"
			>
				<ListOrdered className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().toggleBlockquote().run()}
				isActive={editor.isActive('blockquote')}
				tooltip="Quote"
			>
				<Quote className="size-4" />
			</MenuButton>

			<Separator orientation="vertical" className="mx-1 h-6" />

			{/* History */}
			<MenuButton
				onClick={() => editor.chain().focus().undo().run()}
				disabled={!editor.can().chain().focus().undo().run()}
				tooltip="Undo (Ctrl+Z)"
			>
				<Undo className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().redo().run()}
				disabled={!editor.can().chain().focus().redo().run()}
				tooltip="Redo (Ctrl+Shift+Z)"
			>
				<Redo className="size-4" />
			</MenuButton>

			{/* Image Picker Dialog */}
			<ImagePickerDialog
				open={isImagePickerOpen}
				onOpenChange={setIsImagePickerOpen}
				onSelect={handleImageSelected}
				title="Insert Image"
				description="Choose an image from your library to insert into the editor."
			/>

			{/* Link Dialog */}
			<Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Link</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<Input
							placeholder="https://example.com"
							value={linkUrl}
							onChange={(e) => setLinkUrl(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									handleLinkSave();
								}
							}}
							autoFocus
						/>
						<div className="space-y-3 border-t pt-4">
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={openInNewTab}
									onChange={(e) => setOpenInNewTab(e.target.checked)}
									className="rounded border-input"
								/>
								<span className="text-sm">Open in new tab</span>
							</label>
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={useNofollow}
									onChange={(e) => setUseNofollow(e.target.checked)}
									className="rounded border-input"
								/>
								<span className="text-sm">Add nofollow for external links</span>
							</label>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsLinkDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button onClick={handleLinkSave}>
							{linkUrl ? 'Add Link' : 'Remove Link'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
