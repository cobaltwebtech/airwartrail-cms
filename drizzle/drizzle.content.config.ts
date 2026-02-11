import type { Config } from 'drizzle-kit'

export default {
  schema: ['./src/db/content-schema.ts'],
  out: './drizzle/content',
  dialect: 'sqlite',
  driver: 'd1-http',
} satisfies Config
