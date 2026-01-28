import type { Editor } from '@tiptap/react';
import {
	Bold,
	Code,
	Heading1,
	Heading2,
	Heading3,
	Heading4,
	Italic,
	List,
	ListOrdered,
	Quote,
	Redo,
	Strikethrough,
	Undo,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';

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

			{/* Headings */}
			<MenuButton
				onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
				isActive={editor.isActive('heading', { level: 1 })}
				tooltip="Heading 1"
			>
				<Heading1 className="size-4" />
			</MenuButton>

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
		</div>
	);
}
