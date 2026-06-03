import { Node } from '@tiptap/core';

/**
 * Whitelist validation for iframe src URLs
 * Only allows embeds from trusted platforms
 */
function isAllowedEmbed(src: string): boolean {
	if (!src) return false;

	try {
		new URL(src);
	} catch {
		return false;
	}

	return (
		src.includes('player.vimeo.com') ||
		src.includes('youtube.com') ||
		src.includes('youtube-nocookie.com') ||
		src.includes('youtu.be')
	);
}

/**
 * Iframe extension for Tiptap
 *
 * Allows embedding iframes with security restrictions:
 * - Only whitelisted domains (Vimeo, YouTube)
 * - Validates and preserves relevant attributes
 * - Prevents arbitrary iframe injection
 *
 * Usage: Copy-paste iframe HTML from Vimeo/YouTube share → embed
 *
 * Stored as JSON node:
 * {
 *   type: "iframe",
 *   attrs: {
 *     src: "https://player.vimeo.com/video/123456789",
 *     width: "640",
 *     height: "360",
 *     allow: "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen",
 *     allowfullscreen: true,
 *     frameborder: "0"
 *   }
 * }
 */
export const Iframe = Node.create({
	name: 'iframe',

	group: 'block',

	selectable: true,

	atom: true,

	addOptions() {
		return {
			allowedDomains: [
				'player.vimeo.com',
				'youtube.com',
				'youtube-nocookie.com',
				'youtu.be',
			],
		};
	},

	addAttributes() {
		return {
			src: {
				default: null,
				parseHTML: (element) => element.getAttribute('src'),
			},
			width: {
				default: '640',
				parseHTML: (element) => element.getAttribute('width'),
			},
			height: {
				default: '360',
				parseHTML: (element) => element.getAttribute('height'),
			},
			frameborder: {
				default: '0',
				parseHTML: (element) => element.getAttribute('frameborder'),
			},
			allow: {
				default: null,
				parseHTML: (element) => element.getAttribute('allow'),
			},
			allowfullscreen: {
				default: true,
				parseHTML: (element) => element.hasAttribute('allowfullscreen'),
			},
		};
	},

	parseHTML() {
		return [
			{
				tag: 'iframe',
			},
		];
	},

	renderHTML({ HTMLAttributes }) {
		const src = HTMLAttributes.src as string | null;

		// Validate iframe URL
		if (!src || !isAllowedEmbed(src)) {
			// Return empty div if validation fails - iframe will be discarded
			return ['div', { style: 'display: none;' }];
		}

		// Sanitize attributes
		const attrs: Record<string, string | boolean> = {
			src,
			width: HTMLAttributes.width || '640',
			height: HTMLAttributes.height || '360',
			frameborder: HTMLAttributes.frameborder || '0',
		};

		if (HTMLAttributes.allow) {
			attrs.allow = HTMLAttributes.allow;
		}

		if (HTMLAttributes.allowfullscreen) {
			attrs.allowfullscreen = true;
		}

		return ['iframe', attrs];
	},

	addKeyboardShortcuts() {
		return {};
	},
});
