import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '../generated/prisma/client.js'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set (see .env.example)')

// Neon's WebSocket driver: works in Vercel functions and supports transactions (Better Auth uses them).
export const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })
