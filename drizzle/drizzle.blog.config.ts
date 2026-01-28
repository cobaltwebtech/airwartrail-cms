import type { Config } from 'drizzle-kit'

export default {
  schema: ['./src/db/blog-schema.ts'],
  out: './drizzle/blog',
  dialect: 'sqlite',
  driver: 'd1-http',
} satisfies Config
