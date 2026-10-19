import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../db/client.js'
import { EVENT_KIND_LABELS } from '../../shared/constants.js'
import { tagInput } from '../../shared/schemas.js'
import type { Tag } from '../../shared/types.js'
import type { AppEnv } from '../app.js'
import { readBody } from '../lib/validate.js'

const BUILT_IN = new Set([...Object.values(EVENT_KIND_LABELS), 'Lesson', 'Changed', 'Cancelled'].map((n) => n.toLowerCase()))

/** Reject names that clash with a built-in tag or (case-insensitively) with another of the user's tags. */
async function assertNameFree(userId: string, name: string, exceptId?: string) {
  if (BUILT_IN.has(name.toLowerCase())) throw new HTTPException(400, { message: `"${name}" is a built-in tag` })
  const clash = await prisma.tag.findFirst({
    where: { userId, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
  })
  if (clash) throw new HTTPException(409, { message: `You already have a tag called "${clash.name}"` })
}

async function listTags(userId: string): Promise<Tag[]> {
  const rows = await prisma.tag.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { events: true } } },
  })
  return rows.map((t) => ({ id: t.id, name: t.name, eventCount: t._count.events }))
}

export const tags = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await listTags(c.get('user').id)))
  .post('/', async (c) => {
    const userId = c.get('user').id
    const { name } = await readBody(c, tagInput)
    await assertNameFree(userId, name)
    const row = await prisma.tag.create({ data: { userId, name } })
    return c.json({ id: row.id, name: row.name, eventCount: 0 } satisfies Tag, 201)
  })
  .patch('/:id', async (c) => {
    const userId = c.get('user').id
    const id = c.req.param('id')
    const { name } = await readBody(c, tagInput)
    await assertNameFree(userId, name, id)
    await prisma.tag.update({ where: { id, userId }, data: { name } })
    return c.json((await listTags(userId)).find((t) => t.id === id))
  })
  .delete('/:id', async (c) => {
    // Removes the tag from all events too (implicit join table cascades).
    await prisma.tag.delete({ where: { id: c.req.param('id'), userId: c.get('user').id } })
    return c.body(null, 204)
  })
