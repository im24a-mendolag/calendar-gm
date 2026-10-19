import { Hono, type Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../db/client.js'
import { isoWeekday } from '../../shared/dates.js'
import { isoDate, lessonExceptionInput } from '../../shared/schemas.js'
import type { AppEnv } from '../app.js'
import { fromDbDate, fromDbTime, toDbDate, toDbTimeOrNull } from '../lib/datetime.js'
import { readBody } from '../lib/validate.js'

/** Load the user's slot and check that `date` is a day this lesson actually happens. */
async function slotOn(c: Context<AppEnv>) {
  const date = isoDate.safeParse(c.req.param('date'))
  if (!date.success) throw new HTTPException(400, { message: 'Date must be YYYY-MM-DD' })
  const slot = await prisma.lessonSlot.findFirst({
    where: { id: c.req.param('slotId'), userId: c.get('user').id },
    include: { term: true },
  })
  if (!slot) throw new HTTPException(404, { message: 'Not found' })
  const inTerm = fromDbDate(slot.term.startDate) <= date.data && date.data <= fromDbDate(slot.term.endDate)
  if (isoWeekday(date.data) !== slot.weekday || !inTerm) {
    throw new HTTPException(400, { message: 'This lesson does not take place on that date' })
  }
  return { slot, date: date.data }
}

/** /lessons/:slotId/:date — one dated occurrence of a weekly lesson. */
export const lessons = new Hono<AppEnv>()
  .put('/:slotId/:date', async (c) => {
    const { slot, date } = await slotOn(c)
    const input = await readBody(c, lessonExceptionInput)
    const changed = input.kind === 'changed'
    const start = (changed && input.newStartTime) || fromDbTime(slot.startTime)
    const end = (changed && input.newEndTime) || fromDbTime(slot.endTime)
    if (changed && start >= end) throw new HTTPException(400, { message: 'End time must be after the start time' })
    const data = {
      kind: input.kind,
      newStartTime: changed ? toDbTimeOrNull(input.newStartTime) : null,
      newEndTime: changed ? toDbTimeOrNull(input.newEndTime) : null,
      newRoom: changed ? (input.newRoom ?? null) : null,
      note: input.note ?? null,
    }
    await prisma.lessonException.upsert({
      where: { slotId_date: { slotId: slot.id, date: toDbDate(date) } },
      create: { ...data, userId: slot.userId, slotId: slot.id, date: toDbDate(date) },
      update: data,
    })
    return c.json({ ok: true })
  })
  .delete('/:slotId/:date', async (c) => {
    const { slot, date } = await slotOn(c)
    await prisma.lessonException.deleteMany({ where: { slotId: slot.id, date: toDbDate(date) } })
    return c.body(null, 204)
  })
