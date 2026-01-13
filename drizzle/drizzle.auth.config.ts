import type { Config } from 'drizzle-kit'

export default {
  schema: ['./src/db/auth-schema.ts'],
  out: './drizzle/auth',
  dialect: 'sqlite',
  driver: 'd1-http',
} satisfies Config
