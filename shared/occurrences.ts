import { eachDay, isoWeekday } from './dates.js'
import type { Holiday, LessonException, LessonSlot, Term } from './types.js'

export interface LessonOccurrence {
  slotId: string
  subjectId: string
  date: string
  startTime: string
  endTime: string
  room: string | null
  /** The lesson's own teacher; null = the subject's */
  teacher: string | null
  status: 'scheduled' | 'cancelled' | 'changed'
  note: string | null
}

/**
 * Turn the weekly timetable template into dated lessons for [from, to] (inclusive).
 * A slot occurs on every matching weekday inside its term, except on holidays.
 * Exceptions then cancel or change single occurrences. Cancelled lessons are kept
 * (status 'cancelled') so the UI can show them struck through.
 */
export function expandLessons(input: {
  slots: LessonSlot[]
  terms: Term[]
  holidays: Holiday[]
  exceptions: LessonException[]
  from: string
  to: string
}): LessonOccurrence[] {
  const { slots, terms, holidays, exceptions, from, to } = input
  if (from > to) return []

  const termById = new Map(terms.map((t) => [t.id, t]))
  const exceptionByKey = new Map(exceptions.map((e) => [`${e.slotId}|${e.date}`, e]))
  const isHoliday = (date: string) => holidays.some((h) => h.startDate <= date && date <= h.endDate)

  const out: LessonOccurrence[] = []
  for (const date of eachDay(from, to)) {
    if (isHoliday(date)) continue
    const weekday = isoWeekday(date)
    for (const slot of slots) {
      if (slot.weekday !== weekday) continue
      const term = termById.get(slot.termId)
      if (!term || date < term.startDate || date > term.endDate) continue

      const base: LessonOccurrence = {
        slotId: slot.id,
        subjectId: slot.subjectId,
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
        teacher: slot.teacher,
        status: 'scheduled',
        note: null,
      }
      const ex = exceptionByKey.get(`${slot.id}|${date}`)
      if (!ex) out.push(base)
      else if (ex.kind === 'cancelled') out.push({ ...base, status: 'cancelled', note: ex.note })
      else
        out.push({
          ...base,
          status: 'changed',
          startTime: ex.newStartTime ?? base.startTime,
          endTime: ex.newEndTime ?? base.endTime,
          room: ex.newRoom ?? base.room,
          note: ex.note,
        })
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)))
}
