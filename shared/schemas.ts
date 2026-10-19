import { z } from 'zod'
import { EVENT_KINDS, SUBJECT_COLORS } from './constants.js'

/** 'YYYY-MM-DD' — a local calendar date */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
/** 'HH:MM' — a local wall-clock time */
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM')
const weekday = z.number().int().min(1).max(7)
const optionalText = z.string().trim().max(200).nullish()

const datesInOrder = (v: { startDate: string; endDate: string }) => v.startDate <= v.endDate
const datesError = { message: 'End date must be on or after the start date', path: ['endDate'] }
const timesInOrder = (v: { startTime: string; endTime: string }) => v.startTime < v.endTime
const timesError = { message: 'End time must be after the start time', path: ['endTime'] }

export const subjectInput = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.enum(SUBJECT_COLORS),
  teacher: optionalText,
  defaultRoom: optionalText,
})

const named = z.string().trim().min(1).max(60)
export const termInput = z.object({ name: named, startDate: isoDate, endDate: isoDate }).refine(datesInOrder, datesError)
export const holidayInput = z.object({ name: named, startDate: isoDate, endDate: isoDate }).refine(datesInOrder, datesError)

export const slotInput = z
  .object({ subjectId: z.uuid(), termId: z.uuid(), weekday, startTime: hhmm, endTime: hhmm, room: optionalText })
  .refine(timesInOrder, timesError)
export const slotPatch = z
  .object({
    subjectId: z.uuid(),
    weekday,
    startTime: hhmm,
    endTime: hhmm,
    room: optionalText,
  })
  .partial()

export const settingsPatch = z
  .object({
    timezone: z.string().min(1).max(64),
    showWeekends: z.boolean(),
  })
  .partial()

/** All seven weekdays; time null = no wake-up time that day. */
export const wakeTimesInput = z.array(z.object({ weekday, time: hhmm.nullable() })).length(7)

export type SubjectInput = z.infer<typeof subjectInput>
export type TermInput = z.infer<typeof termInput>
export type HolidayInput = z.infer<typeof holidayInput>
export type SlotInput = z.infer<typeof slotInput>
export type SlotPatch = z.infer<typeof slotPatch>
export type SettingsPatch = z.infer<typeof settingsPatch>
export type WakeTimesInput = z.infer<typeof wakeTimesInput>

export const tagInput = z.object({ name: z.string().trim().min(1, 'Name is required').max(30) })
export type TagInput = z.infer<typeof tagInput>

const longText = z.string().trim().max(2000).nullish()

/** Create/replace an event (exam, appointment, …). Timed events need a start; all-day ones ignore times. */
export const eventInput = z
  .object({
    kind: z.enum(EVENT_KINDS),
    title: z.string().trim().min(1, 'Title is required').max(100),
    subjectId: z.uuid().nullish(),
    date: isoDate,
    /** Last day for multi-day events (inclusive). */
    endDate: isoDate.nullish(),
    allDay: z.boolean().default(false),
    startTime: hhmm.nullish(),
    endTime: hhmm.nullish(),
    location: optionalText,
    topics: longText,
    notes: longText,
    reminderDays: z.number().int().min(0).max(60).nullish(),
    tagIds: z.array(z.uuid()).max(20).default([]),
  })
  .refine((v) => v.allDay || !!v.startTime, { message: 'Start time is required (or make it all-day)', path: ['startTime'] })
  .refine((v) => !v.endDate || v.endDate >= v.date, { message: 'The last day must be on or after the first day', path: ['endDate'] })
  // Times only need to be in order on a single day; multi-day events may end earlier in the day than they start.
  .refine((v) => v.allDay || !v.startTime || !v.endTime || (!!v.endDate && v.endDate > v.date) || v.startTime < v.endTime, timesError)
export type EventInput = z.input<typeof eventInput>

export const homeworkInput = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  subjectId: z.uuid().nullish(),
  dueDate: isoDate,
  notes: longText,
})
export const homeworkPatch = homeworkInput.partial().extend({ done: z.boolean().optional() })
export type HomeworkInput = z.infer<typeof homeworkInput>
export type HomeworkPatch = z.infer<typeof homeworkPatch>

/** Cancel or change one occurrence of a weekly lesson. Empty "changed" fields keep the usual value. */
export const lessonExceptionInput = z
  .object({
    kind: z.enum(['cancelled', 'changed']),
    newStartTime: hhmm.nullish(),
    newEndTime: hhmm.nullish(),
    newRoom: optionalText,
    note: optionalText,
  })
  .refine((v) => v.kind === 'cancelled' || v.newStartTime || v.newEndTime || v.newRoom, {
    message: 'Change the time or the room (or cancel the lesson)',
  })
export type LessonExceptionInput = z.infer<typeof lessonExceptionInput>


/** Exams pasted from the school portal, with the user's choice of subject per school code. */
export const schoolExamImportInput = z.object({
  subjects: z
    .array(
      z.object({
        code: z.string().trim().min(1).max(20),
        /** existing subject to use (null = no subject) … */
        subjectId: z.uuid().nullish(),
        /** … or a new subject to create for this code */
        create: z.object({ name: z.string().trim().min(1).max(60), color: z.enum(SUBJECT_COLORS), teacher: optionalText }).nullish(),
      }),
    )
    .max(50),
  exams: z
    .array(
      z.object({
        key: z.string().min(1).max(100),
        code: z.string().trim().min(1).max(20),
        date: isoDate,
        startTime: hhmm,
        endTime: hhmm,
        room: optionalText,
        note: optionalText,
      }),
    )
    .min(1)
    .max(500),
})
export type SchoolExamImportInput = z.infer<typeof schoolExamImportInput>
