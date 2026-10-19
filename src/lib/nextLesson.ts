import { addDays } from '../../shared/dates'
import { expandLessons } from '../../shared/occurrences'
import type { Holiday, LessonSlot, Term } from '../../shared/types'

/**
 * Date of the next lesson of `subjectId` after `today` (within ~5 weeks), or null.
 * Used as the default due date for new homework.
 */
export function nextLessonDate(
  subjectId: string,
  data: { slots: LessonSlot[]; terms: Term[]; holidays: Holiday[] },
  today: string,
): string | null {
  const lessons = expandLessons({
    slots: data.slots.filter((s) => s.subjectId === subjectId),
    terms: data.terms,
    holidays: data.holidays,
    exceptions: [],
    from: addDays(today, 1),
    to: addDays(today, 35),
  })
  return lessons[0]?.date ?? null
}
