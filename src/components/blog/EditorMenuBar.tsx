import type { Editor } from '@tiptap/react';
import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	AlignRight,
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { ImagePickerDialog, type SelectedImage } from './ImagePickerDialog';

// ============================================================================
// Types
// ============================================================================

/**
 * A snapshot of all toolbar-relevant editor states derived via useEditorState
 * in TiptapEditor. Passing this as a prop (rather than calling editor.isActive()
 * inside the menu bar directly) ensures the toolbar re-renders reactively on
 * every cursor move and selection change.
 */
export interface ActiveEditorState {
	// Marks
	bold: boolean;
	italic: boolean;
	strike: boolean;
	code: boolean;
	link: boolean;
	// Block types
	blockquote: boolean;
	bulletList: boolean;
	orderedList: boolean;
	codeBlock: boolean;
	// Headings
	heading2: boolean;
	heading3: boolean;
	heading4: boolean;
	// Alignment
	alignLeft: boolean;
	alignCenter: boolean;
	alignRight: boolean;
	alignJustify: boolean;
	// TextStyle
	fontSize: string | null;
	// History capability
	canUndo: boolean;
	canRedo: boolean;
	// Mark capability (drives disabled state)
	canBold: boolean;
	canItalic: boolean;
	canStrike: boolean;
	canCode: boolean;
}

interface EditorMenuBarProps {
	editor: Editor;
	/** Reactive state snapshot from useEditorState — drives all isActive highlights */
	activeState: ActiveEditorState | null;
}

interface MenuButtonProps {
	onClick: () => void;
	isActive?: boolean;
	disabled?: boolean;
	tooltip: string;
	children: React.ReactNode;
}

// ============================================================================
// Constants
// ============================================================================

const FONT_SIZES = [
	{ label: '12px', value: '12px' },
	{ label: '14px', value: '14px' },
	{ label: '16px', value: '16px' },
	{ label: '18px', value: '18px' },
	{ label: '20px', value: '20px' },
	{ label: '24px', value: '24px' },
	{ label: '30px', value: '30px' },
	{ label: '36px', value: '36px' },
	{ label: '48px', value: '48px' },
	{ label: '60px', value: '60px' },
	{ label: '72px', value: '72px' },
];

const DEFAULT_FONT_SIZE = '16px';

// ============================================================================
// MenuButton
// ============================================================================

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

// ============================================================================
// EditorMenuBar
// ============================================================================

export function EditorMenuBar({ editor, activeState }: EditorMenuBarProps) {
	const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
	const [linkUrl, setLinkUrl] = useState('');
	const [openInNewTab, setOpenInNewTab] = useState(false);
	const [useNofollow, setUseNofollow] = useState(false);
	const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);

	// Resolve the current font size from the reactive snapshot, falling back to
	// the editor directly (covers the brief window before the first snapshot).
	const currentFontSize =
		activeState?.fontSize ??
		editor.getAttributes('textStyle').fontSize ??
		DEFAULT_FONT_SIZE;

	const handleFontSizeChange = (value: string) => {
		if (value === DEFAULT_FONT_SIZE) {
			editor.chain().focus().unsetFontSize().run();
		} else {
			editor.chain().focus().setFontSize(value).run();
		}
	};

	const handleImageSelected = (image: SelectedImage) => {
		const variant = image.variant || 'md';
		const imageUrl = `${image.deliveryUrl}/${variant}`;
		editor
			.chain()
			.focus()
			.setImage({
				src: imageUrl,
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

	// Handle link clicks from inside the editor content area
	const handleOpenLinkDialog = useEffectEvent((event: Event) => {
		const customEvent = event as CustomEvent<{ href: string; pos: number }>;
		const linkAttrs = editor.getAttributes('link');
		setLinkUrl(customEvent.detail.href || '');
		setOpenInNewTab(linkAttrs.target === '_blank');
		setUseNofollow(linkAttrs.rel?.includes('nofollow') ?? false);
		setIsLinkDialogOpen(true);
		editor.chain().focus().setTextSelection(customEvent.detail.pos).run();
	});

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
			if (openInNewTab) linkAttrs.target = '_blank';
			if (useNofollow) linkAttrs.rel = 'noopener nofollow';
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
			{/* ── Text formatting ─────────────────────────────────────────────── */}
			<MenuButton
				onClick={() => editor.chain().focus().toggleBold().run()}
				isActive={activeState?.bold}
				disabled={!activeState?.canBold}
				tooltip="Bold (Ctrl+B)"
			>
				<Bold className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().toggleItalic().run()}
				isActive={activeState?.italic}
				disabled={!activeState?.canItalic}
				tooltip="Italic (Ctrl+I)"
			>
				<Italic className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().toggleStrike().run()}
				isActive={activeState?.strike}
				disabled={!activeState?.canStrike}
				tooltip="Strikethrough"
			>
				<Strikethrough className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().toggleCode().run()}
				isActive={activeState?.code}
				disabled={!activeState?.canCode}
				tooltip="Inline Code"
			>
				<Code className="size-4" />
			</MenuButton>

			<Separator orientation="vertical" className="mx-1 h-6" />

			{/* ── Font size ────────────────────────────────────────────────────── */}
			<TooltipProvider delayDuration={300}>
				<Tooltip>
					<TooltipTrigger asChild>
						<Select
							value={currentFontSize}
							onValueChange={handleFontSizeChange}
						>
							<SelectTrigger className="h-8 w-20 text-xs">
								<SelectValue placeholder="Size" />
							</SelectTrigger>
							<SelectContent>
								{FONT_SIZES.map(({ label, value }) => (
									<SelectItem key={value} value={value} className="text-xs">
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						<p>Font Size</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<Separator orientation="vertical" className="mx-1 h-6" />

			{/* ── Text alignment ───────────────────────────────────────────────── */}
			<MenuButton
				onClick={() => editor.chain().focus().setTextAlign('left').run()}
				isActive={activeState?.alignLeft}
				tooltip="Align Left"
			>
				<AlignLeft className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().setTextAlign('center').run()}
				isActive={activeState?.alignCenter}
				tooltip="Align Center"
			>
				<AlignCenter className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().setTextAlign('right').run()}
				isActive={activeState?.alignRight}
				tooltip="Align Right"
			>
				<AlignRight className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().setTextAlign('justify').run()}
				isActive={activeState?.alignJustify}
				tooltip="Justify"
			>
				<AlignJustify className="size-4" />
			</MenuButton>

			<Separator orientation="vertical" className="mx-1 h-6" />

			{/* ── Link & Image ─────────────────────────────────────────────────── */}
			<MenuButton
				onClick={handleLinkClick}
				isActive={activeState?.link}
				tooltip="Add Link"
			>
				<Link className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => setIsImagePickerOpen(true)}
				tooltip="Insert Image"
			>
				<ImagePlus className="size-4" />
			</MenuButton>

			<Separator orientation="vertical" className="mx-1 h-6" />

			{/* ── Headings ─────────────────────────────────────────────────────── */}
			<MenuButton
				onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
				isActive={activeState?.heading2}
				tooltip="Heading 2"
			>
				<Heading2 className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
				isActive={activeState?.heading3}
				tooltip="Heading 3"
			>
				<Heading3 className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
				isActive={activeState?.heading4}
				tooltip="Heading 4"
			>
				<Heading4 className="size-4" />
			</MenuButton>

			<Separator orientation="vertical" className="mx-1 h-6" />

			{/* ── Lists & Blockquote ───────────────────────────────────────────── */}
			<MenuButton
				onClick={() => editor.chain().focus().toggleBulletList().run()}
				isActive={activeState?.bulletList}
				tooltip="Bullet List"
			>
				<List className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().toggleOrderedList().run()}
				isActive={activeState?.orderedList}
				tooltip="Numbered List"
			>
				<ListOrdered className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().toggleBlockquote().run()}
				isActive={activeState?.blockquote}
				tooltip="Quote"
			>
				<Quote className="size-4" />
			</MenuButton>

			<Separator orientation="vertical" className="mx-1 h-6" />

			{/* ── History ──────────────────────────────────────────────────────── */}
			<MenuButton
				onClick={() => editor.chain().focus().undo().run()}
				disabled={!activeState?.canUndo}
				tooltip="Undo (Ctrl+Z)"
			>
				<Undo className="size-4" />
			</MenuButton>

			<MenuButton
				onClick={() => editor.chain().focus().redo().run()}
				disabled={!activeState?.canRedo}
				tooltip="Redo (Ctrl+Shift+Z)"
			>
				<Redo className="size-4" />
			</MenuButton>

			{/* ── Dialogs ──────────────────────────────────────────────────────── */}
			<ImagePickerDialog
				open={isImagePickerOpen}
				onOpenChange={setIsImagePickerOpen}
				onSelect={handleImageSelected}
				title="Insert Image"
				description="Choose an image from your library to insert into the editor."
			/>

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
								if (e.key === 'Enter') handleLinkSave();
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
