import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../db/client.js'
import type * as db from '../../generated/prisma/client.js'
import { homeworkInput, homeworkPatch, isoDate } from '../../shared/schemas.js'
import type { Homework } from '../../shared/types.js'
import type { AppEnv } from '../app.js'
import { fromDbDate, toDbDate } from '../lib/datetime.js'
import { readBody } from '../lib/validate.js'

const homeworkDto = (h: db.Homework): Homework => ({
  id: h.id,
  title: h.title,
  notes: h.notes,
  subjectId: h.subjectId,
  dueDate: fromDbDate(h.dueDate),
  done: h.doneAt !== null,
  doneAt: h.doneAt?.toISOString() ?? null,
})

async function assertSubject(userId: string, subjectId: string | null | undefined) {
  if (subjectId && !(await prisma.subject.count({ where: { id: subjectId, userId } }))) {
    throw new HTTPException(400, { message: 'Unknown subject' })
  }
}

export const homework = new Hono<AppEnv>()
  /** GET /homework?status=open|done|all&doneSince=YYYY-MM-DD */
  .get('/', async (c) => {
    const status = c.req.query('status') ?? 'all'
    const since = isoDate.safeParse(c.req.query('doneSince'))
    const rows = await prisma.homework.findMany({
      where: {
        userId: c.get('user').id,
        ...(status === 'open' ? { doneAt: null } : {}),
        ...(status === 'done' ? { doneAt: { not: null, ...(since.success ? { gte: toDbDate(since.data) } : {}) } } : {}),
      },
      orderBy: [{ dueDate: status === 'done' ? 'desc' : 'asc' }, { createdAt: 'asc' }],
      take: 500,
    })
    return c.json(rows.map(homeworkDto))
  })
  .post('/', async (c) => {
    const userId = c.get('user').id
    const input = await readBody(c, homeworkInput)
    await assertSubject(userId, input.subjectId)
    const row = await prisma.homework.create({
      data: {
        userId,
        title: input.title,
        subjectId: input.subjectId ?? null,
        dueDate: toDbDate(input.dueDate),
        notes: input.notes ?? null,
      },
    })
    return c.json(homeworkDto(row), 201)
  })
  .patch('/:id', async (c) => {
    const userId = c.get('user').id
    const { done, dueDate, ...rest } = await readBody(c, homeworkPatch)
    await assertSubject(userId, rest.subjectId)
    const row = await prisma.homework.update({
      where: { id: c.req.param('id'), userId },
      data: {
        ...rest,
        ...(dueDate ? { dueDate: toDbDate(dueDate) } : {}),
        ...(done === undefined ? {} : { doneAt: done ? new Date() : null }),
      },
    })
    return c.json(homeworkDto(row))
  })
  .delete('/:id', async (c) => {
    await prisma.homework.delete({ where: { id: c.req.param('id'), userId: c.get('user').id } })
    return c.body(null, 204)
  })
