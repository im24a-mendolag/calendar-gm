import { createAuthClient } from 'better-auth/react'

// Same origin: Vite proxies /api in dev, Vercel serves /api in production.
export const authClient = createAuthClient()

export const { useSession, signIn, signUp, signOut } = authClient
