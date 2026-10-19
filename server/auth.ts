import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '../db/client.js'

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: '/api/auth',
  // Dev: Vite may move to 5174+ if 5173 is taken. Production only trusts BETTER_AUTH_URL.
  trustedOrigins: process.env.NODE_ENV === 'production' ? [] : ['http://localhost:*'],
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
})

export type AuthUser = typeof auth.$Infer.Session.user
export type AuthSession = typeof auth.$Infer.Session.session
