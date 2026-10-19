import { handle } from 'hono/vercel'
import { app } from '../server/app.js'

// Vercel Node.js function using the Web Request/Response signature.
// vercel.json rewrites /api/* here; Hono routes on the original path.
const handler = handle(app)

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const OPTIONS = handler
