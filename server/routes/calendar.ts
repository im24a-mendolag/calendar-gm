import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../db/client.js'
import { daysBetween, eachDay, isoWeekday } from '../../shared/dates.js'
import { expandLessons } from '../../shared/occurrences.js'
import { isoDate } from '../../shared/schemas.js'
import type { CalendarDay, CalendarEvent, CalendarHomework, CalendarResponse, LessonException } from '../../shared/types.js'
import type { AppEnv } from '../app.js'
import { fromDbDate, fromDbTimeOrNull, toDbDate } from '../lib/datetime.js'
import { eventDto, eventInclude } from '../lib/events.js'
import { holidayDto, slotDto, termDto } from '../lib/serialize.js'

const MAX_RANGE_DAYS = 62

export const calendar = new Hono<AppEnv>().get('/', async (c) => {
  const userId = c.get('user').id
  const from = isoDate.safeParse(c.req.query('from'))
  const to = isoDate.safeParse(c.req.query('to'))
  if (!from.success || !to.success) throw new HTTPException(400, { message: 'from and to must be YYYY-MM-DD' })
  if (from.data > to.data || daysBetween(from.data, to.data) > MAX_RANGE_DAYS) {
    throw new HTTPException(400, { message: `Range must be 0–${MAX_RANGE_DAYS} days` })
  }
  const range = { gte: toDbDate(from.data), lte: toDbDate(to.data) }

  const [slots, terms, holidays, exceptions, events, homework, wakeTimes, overrides] = await Promise.all([
    prisma.lessonSlot.findMany({ where: { userId } }),
    prisma.term.findMany({ where: { userId } }),
    prisma.holiday.findMany({ where: { userId } }),
    prisma.lessonException.findMany({ where: { userId, date: range } }),
    prisma.event.findMany({
      where: { userId, date: range },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      include: eventInclude,
    }),
    prisma.homework.findMany({ where: { userId, dueDate: range }, orderBy: { dueDate: 'asc' } }),
    prisma.wakeTime.findMany({ where: { userId } }),
    prisma.wakeTimeOverride.findMany({ where: { userId, date: range } }),
  ])

  const holidayDtos = holidays.map(holidayDto)
  const exceptionDtos: LessonException[] = exceptions.map((e) => ({
    id: e.id,
    slotId: e.slotId,
    date: fromDbDate(e.date),
    kind: e.kind,
    newStartTime: fromDbTimeOrNull(e.newStartTime),
    newEndTime: fromDbTimeOrNull(e.newEndTime),
    newRoom: e.newRoom,
    note: e.note,
  }))

  const lessons = expandLessons({
    slots: slots.map(slotDto),
    terms: terms.map(termDto),
    holidays: holidayDtos,
    exceptions: exceptionDtos,
    from: from.data,
    to: to.data,
  })

  const days: CalendarDay[] = eachDay(from.data, to.data).map((date) => {
    const isHoliday = holidayDtos.some((h) => h.startDate <= date && date <= h.endDate)
    const override = overrides.find((o) => fromDbDate(o.date) === date)
    const weekdayDefault = wakeTimes.find((w) => w.weekday === isoWeekday(date))
    const wakeTime = override
      ? fromDbTimeOrNull(override.time)
      : isHoliday
        ? null
        : fromDbTimeOrNull(weekdayDefault?.time ?? null)
    return { date, wakeTime, isHoliday }
  })

  const eventDtos: CalendarEvent[] = events.map(eventDto)

  const homeworkDtos: CalendarHomework[] = homework.map((h) => ({
    id: h.id,
    title: h.title,
    subjectId: h.subjectId,
    dueDate: fromDbDate(h.dueDate),
    done: h.doneAt !== null,
  }))

  const body: CalendarResponse = { from: from.data, to: to.data, days, lessons, events: eventDtos, homework: homeworkDtos }
  return c.json(body)
})
