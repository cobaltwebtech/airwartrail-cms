import type { Config } from 'drizzle-kit'

export default {
  schema: ['./src/db/video-schema.ts'],
  out: './drizzle/videos',
  dialect: 'sqlite',
  driver: 'd1-http',
} satisfies Config
