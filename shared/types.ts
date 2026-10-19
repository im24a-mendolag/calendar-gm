// JSON shapes returned by the API. Dates are 'YYYY-MM-DD', times are 'HH:MM' (local, user's timezone).
import type { EventKind, SubjectColor } from './constants.js'
import type { LessonOccurrence } from './occurrences.js'

export interface Subject {
  id: string
  name: string
  color: SubjectColor
  teacher: string | null
  defaultRoom: string | null
}

export interface Term {
  id: string
  name: string
  startDate: string
  endDate: string
}

export interface Holiday {
  id: string
  name: string
  startDate: string
  endDate: string
}

export interface LessonSlot {
  id: string
  subjectId: string
  termId: string
  weekday: number
  startTime: string
  endTime: string
  room: string | null
  /** null = the subject's teacher */
  teacher: string | null
}

export interface LessonException {
  id: string
  slotId: string
  date: string
  kind: 'cancelled' | 'changed'
  newStartTime: string | null
  newEndTime: string | null
  newRoom: string | null
  note: string | null
}

/** A user-made tag. */
export interface Tag {
  id: string
  name: string
  /** How many events use it. */
  eventCount: number
}

export interface WakeTime {
  weekday: number
  time: string | null
}

export interface Settings {
  timezone: string
  showWeekends: boolean
  wakeTimes: WakeTime[]
}

export interface CalendarEvent {
  id: string
  kind: EventKind
  title: string
  subjectId: string | null
  date: string
  /** Last day of a multi-day event (inclusive); null = single day. */
  endDate: string | null
  startTime: string | null
  endTime: string | null
  allDay: boolean
  location: string | null
  topics: string | null
  notes: string | null
  reminderDays: number | null
  /** The user's own tags (names, A–Z), shown after the built-in kind tag. */
  tags: string[]
  /** Same tags as ids, in the same order (for the editor). */
  tagIds: string[]
}

export interface CalendarHomework {
  id: string
  title: string
  subjectId: string | null
  dueDate: string
  done: boolean
}

export interface CalendarDay {
  date: string
  /** Wake-up time shown at the start of the day; null = none (e.g. holidays). */
  wakeTime: string | null
  isHoliday: boolean
}

/** GET /api/calendar?from&to */
export interface CalendarResponse {
  from: string
  to: string
  days: CalendarDay[]
  lessons: LessonOccurrence[]
  events: CalendarEvent[]
  homework: CalendarHomework[]
}

export interface Homework {
  id: string
  title: string
  notes: string | null
  subjectId: string | null
  dueDate: string
  done: boolean
  /** ISO timestamp when it was ticked off */
  doneAt: string | null
}
