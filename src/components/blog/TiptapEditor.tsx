import Link from '@tiptap/extension-link';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';
import { EditorMenuBar } from './EditorMenuBar';

interface TiptapEditorProps {
	content: unknown;
	onChange: (content: unknown) => void;
	disabled?: boolean;
	placeholder?: string;
}

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
			}),
		],
		content: content as string | null,
		editable: !disabled,
		editorProps: {
			attributes: {
				class:
					'prose prose-sm sm:prose-base dark:prose-invert max-w-none min-h-[300px] p-4 focus:outline-none',
				'data-placeholder': placeholder,
			},
		},
		onUpdate: ({ editor: currentEditor }) => {
			onChange(currentEditor.getJSON());
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
			<div className="border-input bg-secondary min-h-[300px] rounded-md border p-4 animate-pulse">
				<div className="h-4 w-3/4 bg-muted rounded mb-2" />
				<div className="h-4 w-1/2 bg-muted rounded" />
			</div>
		);
	}

	return (
		<div className="border-input bg-secondary rounded-md border overflow-hidden">
			<EditorMenuBar editor={editor} />
			<EditorContent editor={editor} />
		</div>
	);
}
