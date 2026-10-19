import { defineConfig } from 'prisma/config'

// Prisma 7 doesn't load .env files by itself.
try {
  process.loadEnvFile('.env.local')
} catch {
  // no .env.local (e.g. on Vercel) — use the real environment
}

// Migrations need Neon's *direct* connection (the app uses the pooled DATABASE_URL).
// If DIRECT_URL isn't set, derive it: Neon's direct host is the pooled host without "-pooler".
const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL?.replace('-pooler.', '.')

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: directUrl },
})
