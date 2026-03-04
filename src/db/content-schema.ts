import { relations, sql } from 'drizzle-orm';
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * Pages Table Schema
 * Stores static pages for the CMS
 */
export const pages = sqliteTable(
	'pages',
	{
		// Primary identifier
		id: text('id').primaryKey(),

		// SEO and URL
		slug: text('slug').notNull().unique(),
		title: text('title').notNull(),

		// Content
		pageContent: text('page_content', { mode: 'json' }), // JSON content data for rich text editor

		// Publishing
		publishStatus: text('publish_status', {
			enum: ['published', 'unpublished'],
		})
			.default('unpublished')
			.notNull(),
		publishedAt: integer('published_at', { mode: 'timestamp_ms' }),

		// Author and ownership
		author: text('author').notNull(),
		authorId: text('author_id'),

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
		index('pages_slug_idx').on(table.slug),
		index('pages_publish_status_idx').on(table.publishStatus),
		index('pages_author_idx').on(table.author),
		index('pages_published_at_idx').on(table.publishedAt),
		index('pages_created_at_idx').on(table.createdAt),
	],
);

/**
 * Blog Posts Table Schema
 * Stores blog posts for the CMS
 */
export const blogPosts = sqliteTable(
	'blog_posts',
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
			enum: ['draft', 'published', 'archived'],
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

// ---------------------------------------------------------------------------
// Images and Albums Schema
// ---------------------------------------------------------------------------

/**
 * Documents Table Schema
 * Tracks documents stored in Cloudflare R2 object storage
 */
export const documents = sqliteTable(
	'documents',
	{
		// Primary identifier
		id: text('id').primaryKey(),

		// Document metadata
		name: text('name').notNull(),
		description: text('description'),

		// File information (stored in Cloudflare R2)
		fileUrl: text('file_url').notNull(),
		fileSize: integer('file_size'), // Size in bytes
		mimeType: text('mime_type'),

		// Publishing
		publishStatus: text('publish_status', {
			enum: ['draft', 'published', 'archived'],
		})
			.default('draft')
			.notNull(),

		// Author and ownership
		author: text('author').notNull(),
		authorId: text('author_id'),

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
		index('documents_publish_status_idx').on(table.publishStatus),
		index('documents_author_idx').on(table.author),
		index('documents_created_at_idx').on(table.createdAt),
	],
);

/**
 * Images Table Schema
 * Tracks all Cloudflare Images uploaded/used in this project
 * Provides a project-level record of images independent of albums
 */
export const images = sqliteTable(
	'images',
	{
		// Primary identifier (project internal ID)
		id: text('id').primaryKey(),

		// Cloudflare Images identifiers
		cfImageId: text('cf_image_id').notNull().unique(), // Cloudflare Images image ID
		deliveryUrl: text('delivery_url').notNull(), // imagedelivery.net URL

		// Image metadata
		fileName: text('file_name'),
		altText: text('alt_text'),
		width: integer('width'),
		height: integer('height'),

		// Access control
		requireSignedURLs: integer('require_signed_urls', { mode: 'boolean' })
			.default(false)
			.notNull(),

		// Extra metadata (JSON – format, file size, tags, etc.)
		metadata: text('metadata', { mode: 'json' }),

		// Timestamps
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		index('images_cf_image_id_idx').on(table.cfImageId),
		index('images_created_at_idx').on(table.createdAt),
	],
);

/**
 * Albums Table Schema
 * Organizes images into albums/galleries
 */
export const albums = sqliteTable(
	'albums',
	{
		// Primary identifier
		id: text('id').primaryKey(),

		// SEO and URL
		slug: text('slug').notNull().unique(),
		title: text('title').notNull(),
		description: text('description'),

		// Cover image (references an image, not album_images)
		coverImageId: text('cover_image_id').references(() => images.id, {
			onDelete: 'set null',
		}),

		// Publishing
		publishStatus: text('publish_status', {
			enum: ['draft', 'published', 'archived'],
		})
			.default('draft')
			.notNull(),

		// Author and ownership
		authorId: text('author_id'),

		// Counts (denormalized for fast reads)
		imageCount: integer('image_count').default(0).notNull(),

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
		index('albums_slug_idx').on(table.slug),
		index('albums_publish_status_idx').on(table.publishStatus),
		index('albums_author_id_idx').on(table.authorId),
		index('albums_created_at_idx').on(table.createdAt),
	],
);

/**
 * Album Images Table Schema
 * Junction table linking images to albums with album-specific ordering/metadata
 */
export const albumImages = sqliteTable(
	'album_images',
	{
		// Primary identifier
		id: text('id').primaryKey(),

		// Album reference
		albumId: text('album_id')
			.notNull()
			.references(() => albums.id, { onDelete: 'cascade' }),

		// Image reference (many-to-many relationship)
		imageId: text('image_id')
			.notNull()
			.references(() => images.id, { onDelete: 'cascade' }),

		// Ordering within the album
		sortOrder: integer('sort_order').default(0).notNull(),

		// Timestamps
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		uniqueIndex('album_images_album_image_unique').on(
			table.albumId,
			table.imageId,
		),
		index('album_images_album_id_idx').on(table.albumId),
		index('album_images_image_id_idx').on(table.imageId),
		index('album_images_sort_order_idx').on(table.albumId, table.sortOrder),
	],
);

// ---------------------------------------------------------------------------
// Drizzle Relations
// ---------------------------------------------------------------------------

export const imagesRelations = relations(images, ({ many }) => ({
	// One image can be the cover of multiple albums
	albumCovers: many(albums),
	// One image can be in many albums via the albumImages junction
	albums: many(albumImages),
}));

export const albumsRelations = relations(albums, ({ many, one }) => ({
	// One album has many images (via junction)
	images: many(albumImages),
	// One album has one cover image
	coverImage: one(images, {
		fields: [albums.coverImageId],
		references: [images.id],
	}),
}));

export const albumImagesRelations = relations(albumImages, ({ one }) => ({
	// Each junction row belongs to one album
	album: one(albums, {
		fields: [albumImages.albumId],
		references: [albums.id],
	}),
	// Each junction row belongs to one image
	image: one(images, {
		fields: [albumImages.imageId],
		references: [images.id],
	}),
}));
