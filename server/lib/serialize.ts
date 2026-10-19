import type * as db from '../../generated/prisma/client.js'
import type { Holiday, LessonSlot, Subject, Term } from '../../shared/types.js'
import { fromDbDate, fromDbTime } from './datetime.js'

export const subjectDto = (s: db.Subject): Subject => ({
  id: s.id,
  name: s.name,
  color: s.color,
  teacher: s.teacher,
  defaultRoom: s.defaultRoom,
})

export const termDto = (t: db.Term): Term => ({
  id: t.id,
  name: t.name,
  startDate: fromDbDate(t.startDate),
  endDate: fromDbDate(t.endDate),
})

export const holidayDto = (h: db.Holiday): Holiday => ({
  id: h.id,
  name: h.name,
  startDate: fromDbDate(h.startDate),
  endDate: fromDbDate(h.endDate),
})

export const slotDto = (s: db.LessonSlot): LessonSlot => ({
  id: s.id,
  subjectId: s.subjectId,
  termId: s.termId,
  weekday: s.weekday,
  startTime: fromDbTime(s.startTime),
  endTime: fromDbTime(s.endTime),
  room: s.room,
})
