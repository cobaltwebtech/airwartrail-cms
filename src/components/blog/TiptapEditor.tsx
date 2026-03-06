import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { FontSize, TextStyle } from '@tiptap/extension-text-style';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';
import type { ActiveEditorState } from './EditorMenuBar';
import { EditorMenuBar } from './EditorMenuBar';

interface TiptapEditorProps {
	content: unknown;
	onChange: (content: unknown) => void;
	disabled?: boolean;
	placeholder?: string;
}

// Custom Image extension that applies thumbnail variant in editor for preview
// but the actual stored URL contains md or mdnomark variant for database
const CustomImage = Image.extend({
	renderHTML({ HTMLAttributes }) {
		// Apply thumbnail variant for editor preview only
		let src = HTMLAttributes.src;
		if (src) {
			// Remove any existing variant suffix (md, mdnomark, thumbnail, etc.)
			src = src.replace(/\/(md|mdnomark|thumbnail)$/, '');
			// Add thumbnail variant for editor preview
			src = `${src}/thumbnail`;
		}
		return ['img', { ...HTMLAttributes, src }];
	},
});

export function TiptapEditor({
	content,
	onChange,
	disabled = false,
	placeholder = 'Start writing your blog post...',
}: TiptapEditorProps) {
	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: {
					levels: [1, 2, 3, 4],
				},
			}),
			Link.configure({
				openOnClick: false,
				HTMLAttributes: {
					target: null,
					rel: null,
				},
			}),
			CustomImage.configure({
				inline: false,
				allowBase64: false,
				HTMLAttributes: {
					class: 'rounded-lg',
				},
			}),
			TextAlign.configure({
				types: ['heading', 'paragraph'],
			}),
			TextStyle,
			FontSize,
		],
		content: content as string | null,
		editable: !disabled,
		editorProps: {
			attributes: {
				class:
					'prose prose-sm sm:prose-base dark:prose-invert max-w-none min-h-75 p-4 focus:outline-none',
				'data-placeholder': placeholder,
			},
			handleClick: (_view, pos, event) => {
				const target = event.target as HTMLElement;
				const link = target.closest('a');
				if (link) {
					event.preventDefault();
					const href = link.getAttribute('href') || '';
					// Dispatch custom event to open link dialog
					window.dispatchEvent(
						new CustomEvent('openLinkDialog', { detail: { href, pos } }),
					);
					return true;
				}
				return false;
			},
		},
		onUpdate: ({ editor: currentEditor }) => {
			onChange(currentEditor.getJSON());
		},
	});

	// Derive a snapshot of all toolbar-relevant active states on every
	// selection change or transaction. useEditorState re-renders only this
	// component (and EditorMenuBar) — not the full editor — keeping it cheap.
	const activeState = useEditorState({
		editor,
		selector: (ctx): ActiveEditorState => {
			const e = ctx.editor;
			if (!e) {
				return {
					bold: false,
					italic: false,
					strike: false,
					code: false,
					link: false,
					blockquote: false,
					bulletList: false,
					orderedList: false,
					codeBlock: false,
					heading2: false,
					heading3: false,
					heading4: false,
					alignLeft: false,
					alignCenter: false,
					alignRight: false,
					alignJustify: false,
					fontSize: null,
					canUndo: false,
					canRedo: false,
					canBold: false,
					canItalic: false,
					canStrike: false,
					canCode: false,
				};
			}
			return {
				bold: e.isActive('bold'),
				italic: e.isActive('italic'),
				strike: e.isActive('strike'),
				code: e.isActive('code'),
				link: e.isActive('link'),
				blockquote: e.isActive('blockquote'),
				bulletList: e.isActive('bulletList'),
				orderedList: e.isActive('orderedList'),
				codeBlock: e.isActive('codeBlock'),
				heading2: e.isActive('heading', { level: 2 }),
				heading3: e.isActive('heading', { level: 3 }),
				heading4: e.isActive('heading', { level: 4 }),
				alignLeft: e.isActive({ textAlign: 'left' }),
				alignCenter: e.isActive({ textAlign: 'center' }),
				alignRight: e.isActive({ textAlign: 'right' }),
				alignJustify: e.isActive({ textAlign: 'justify' }),
				fontSize: e.getAttributes('textStyle').fontSize ?? null,
				canUndo: e.can().undo(),
				canRedo: e.can().redo(),
				canBold: e.can().toggleBold(),
				canItalic: e.can().toggleItalic(),
				canStrike: e.can().toggleStrike(),
				canCode: e.can().toggleCode(),
			};
		},
	});

	// Update content when it changes from outside (e.g., loading data)
	useEffect(() => {
		if (editor && content && editor.isEmpty) {
			editor.commands.setContent(content as string);
		}
	}, [editor, content]);

	// Update editable state when disabled prop changes
	useEffect(() => {
		if (editor) {
			editor.setEditable(!disabled);
		}
	}, [editor, disabled]);

	if (!editor) {
		return (
			<div className="border-input bg-secondary min-h-75 rounded-md border p-4 animate-pulse">
				<div className="h-4 w-3/4 bg-muted rounded mb-2" />
				<div className="h-4 w-1/2 bg-muted rounded" />
			</div>
		);
	}

	return (
		<div className="border-input bg-secondary rounded-md border overflow-hidden">
			<EditorMenuBar editor={editor} activeState={activeState} />
			<EditorContent editor={editor} className="max-h-150 overflow-y-auto" />
		</div>
	);
}
