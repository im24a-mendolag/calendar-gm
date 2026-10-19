import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { z } from 'zod'

/** Parse and validate the JSON body; responds 400 with readable messages on failure. */
export async function readBody<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let json: unknown
  try {
    json = await c.req.json()
  } catch {
    throw new HTTPException(400, { message: 'Invalid JSON body' })
  }
  const result = schema.safeParse(json)
  if (!result.success) {
    const message = result.error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ')
    throw new HTTPException(400, { message })
  }
  return result.data
}
