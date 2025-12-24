import type { Config } from 'drizzle-kit'

export default {
  schema: './src/lib/auth-schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'd1-http',
} satisfies Config
