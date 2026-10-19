import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../db/client.js'
import { EVENT_KINDS, type EventKind } from '../../shared/constants.js'
import { eventInput, isoDate } from '../../shared/schemas.js'
import type { AppEnv } from '../app.js'
import { toDbDate, toDbTimeOrNull } from '../lib/datetime.js'
import { eventDto, eventInclude, overlapping } from '../lib/events.js'
import { readBody } from '../lib/validate.js'

/** The subject and every tag must belong to the signed-in user. */
async function assertOwned(userId: string, subjectId: string | null | undefined, tagIds: string[]) {
  if (subjectId && !(await prisma.subject.count({ where: { id: subjectId, userId } }))) {
    throw new HTTPException(400, { message: 'Unknown subject' })
  }
  const unique = [...new Set(tagIds)]
  if (unique.length && (await prisma.tag.count({ where: { id: { in: unique }, userId } })) !== unique.length) {
    throw new HTTPException(400, { message: 'Unknown tag' })
  }
}

function toData(input: ReturnType<typeof eventInput.parse>) {
  const timed = !input.allDay
  return {
    kind: input.kind,
    title: input.title,
    subjectId: input.subjectId ?? null,
    date: toDbDate(input.date),
    endDate: input.endDate && input.endDate > input.date ? toDbDate(input.endDate) : null,
    allDay: input.allDay,
    startTime: timed ? toDbTimeOrNull(input.startTime) : null,
    endTime: timed ? toDbTimeOrNull(input.endTime) : null,
    location: input.location ?? null,
    topics: input.topics ?? null,
    notes: input.notes ?? null,
    reminderDays: input.reminderDays ?? null,
  }
}

export const events = new Hono<AppEnv>()
  /**
   * GET /events?from=&to=&kinds=exam,test&order=desc&limit=
   * Used by the Exams page and the "Coming up" lists; the week view uses /calendar.
   */
  .get('/', async (c) => {
    const q = c.req.query()
    const date = (v: string | undefined) => {
      if (!v) return undefined
      const r = isoDate.safeParse(v)
      if (!r.success) throw new HTTPException(400, { message: 'from/to must be YYYY-MM-DD' })
      return r.data
    }
    const from = date(q.from)
    const to = date(q.to)
    const kinds = q.kinds?.split(',').filter((k): k is EventKind => (EVENT_KINDS as readonly string[]).includes(k))
    const order = q.order === 'desc' ? 'desc' : 'asc'
    const rows = await prisma.event.findMany({
      where: {
        userId: c.get('user').id,
        ...(from && to ? overlapping(from, to) : {}),
        // open-ended ranges: still running (from) / started by (to)
        ...(from && !to ? { OR: [{ date: { gte: toDbDate(from) } }, { endDate: { gte: toDbDate(from) } }] } : {}),
        ...(to && !from ? { date: { lte: toDbDate(to) } } : {}),
        ...(kinds?.length ? { kind: { in: kinds } } : {}),
      },
      orderBy: [{ date: order }, { startTime: order }],
      take: Math.min(Number(q.limit) || 200, 500),
      include: eventInclude,
    })
    return c.json(rows.map(eventDto))
  })
  .post('/', async (c) => {
    const userId = c.get('user').id
    const input = await readBody(c, eventInput)
    await assertOwned(userId, input.subjectId, input.tagIds)
    const row = await prisma.event.create({
      data: { ...toData(input), userId, tags: { connect: input.tagIds.map((id) => ({ id })) } },
      include: eventInclude,
    })
    return c.json(eventDto(row), 201)
  })
  .put('/:id', async (c) => {
    const userId = c.get('user').id
    const input = await readBody(c, eventInput)
    await assertOwned(userId, input.subjectId, input.tagIds)
    const row = await prisma.event.update({
      where: { id: c.req.param('id'), userId },
      data: { ...toData(input), tags: { set: input.tagIds.map((id) => ({ id })) } },
      include: eventInclude,
    })
    return c.json(eventDto(row))
  })
  .delete('/:id', async (c) => {
    await prisma.event.delete({ where: { id: c.req.param('id'), userId: c.get('user').id } })
    return c.body(null, 204)
  })
