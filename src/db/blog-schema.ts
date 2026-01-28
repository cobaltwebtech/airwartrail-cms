import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Posts Table Schema
 * Stores blog posts for the CMS
 */
export const posts = sqliteTable(
	'posts',
	{
		// Primary identifier
		id: text('id').primaryKey(),

		// SEO and URL
		slug: text('slug').notNull().unique(),
		title: text('title').notNull(),
		short_description: text('short_description'), // Short description for previews and SEO

		// Content
		postContent: text('post_content', { mode: 'json' }), // JSON content data for rich text editor

		// Media
		featuredImageUrl: text('featured_image_url'),
		featuredImageAlt: text('featured_image_alt'), // Accessibility and SEO

		// Publishing
		publishStatus: text('publish_status', {
			enum: ['draft', 'published', 'scheduled', 'archived'],
		})
			.default('draft')
			.notNull(),
		publishedAt: integer('published_at', { mode: 'timestamp_ms' }), // When the post was/will be published

		// Author and ownership
		author: text('author').notNull(), // Could be user ID or name
		authorId: text('author_id'), // Reference to user table if needed

		// Content flags
		isFeatured: integer('is_featured', { mode: 'boolean' })
			.default(false)
			.notNull(), // Highlight on homepage

		// Reading estimate
		readingTimeMinutes: integer('reading_time_minutes'), // Estimated reading time

		// Timestamps
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		// Indexes for common queries
		index('posts_slug_idx').on(table.slug),
		index('posts_publish_status_idx').on(table.publishStatus),
		index('posts_author_idx').on(table.author),
		index('posts_published_at_idx').on(table.publishedAt),
		index('posts_created_at_idx').on(table.createdAt),
	],
);
