import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../db/client.js'
import { slotInput, slotPatch } from '../../shared/schemas.js'
import type { AppEnv } from '../app.js'
import { toDbTime } from '../lib/datetime.js'
import { slotDto } from '../lib/serialize.js'
import { readBody } from '../lib/validate.js'

async function assertOwned(userId: string, ids: { subjectId?: string; termId?: string }) {
  const [subjectOk, termOk] = await Promise.all([
    ids.subjectId ? prisma.subject.count({ where: { id: ids.subjectId, userId } }) : 1,
    ids.termId ? prisma.term.count({ where: { id: ids.termId, userId } }) : 1,
  ])
  if (!subjectOk) throw new HTTPException(400, { message: 'Unknown subject' })
  if (!termOk) throw new HTTPException(400, { message: 'Unknown term' })
}

/** Weekly lessons ("slots"): weekday + real start/end time, per term. */
export const slots = new Hono<AppEnv>()
  .get('/', async (c) => {
    const termId = c.req.query('termId')
    const rows = await prisma.lessonSlot.findMany({
      where: { userId: c.get('user').id, ...(termId ? { termId } : {}) },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    })
    return c.json(rows.map(slotDto))
  })
  .post('/', async (c) => {
    const userId = c.get('user').id
    const data = await readBody(c, slotInput)
    await assertOwned(userId, data)
    const row = await prisma.lessonSlot.create({
      data: { ...data, userId, startTime: toDbTime(data.startTime), endTime: toDbTime(data.endTime) },
    })
    return c.json(slotDto(row), 201)
  })
  .patch('/:id', async (c) => {
    const userId = c.get('user').id
    const id = c.req.param('id')
    const { startTime, endTime, ...rest } = await readBody(c, slotPatch)
    const existing = await prisma.lessonSlot.findFirst({ where: { id, userId } })
    if (!existing) throw new HTTPException(404, { message: 'Not found' })
    const start = startTime ? toDbTime(startTime) : existing.startTime
    const end = endTime ? toDbTime(endTime) : existing.endTime
    if (start >= end) throw new HTTPException(400, { message: 'End time must be after the start time' })
    await assertOwned(userId, { subjectId: rest.subjectId })
    const row = await prisma.lessonSlot.update({ where: { id, userId }, data: { ...rest, startTime: start, endTime: end } })
    return c.json(slotDto(row))
  })
  .delete('/:id', async (c) => {
    await prisma.lessonSlot.delete({ where: { id: c.req.param('id'), userId: c.get('user').id } })
    return c.body(null, 204)
  })
