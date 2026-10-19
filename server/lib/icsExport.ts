// iCalendar (RFC 5545) export, written by hand: the format is small and this keeps full control
// over recurrence, exceptions and time zones.
import { EVENT_KIND_LABELS } from '../../shared/constants.js'
import { addDays, isoWeekday } from '../../shared/dates.js'
import type { CalendarEvent, Holiday, LessonException, LessonSlot, Subject, Term } from '../../shared/types.js'

export interface ExportInput {
  timezone: string
  subjects: Subject[]
  terms: Term[]
  holidays: Holiday[]
  slots: LessonSlot[]
  exceptions: LessonException[]
  events: CalendarEvent[]
  /** For DTSTAMP; injectable for tests. */
  now?: Date
}

/** Escape a TEXT value (RFC 5545 §3.3.11). */
export const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Fold a content line to at most 75 octets, never splitting a UTF-8 character. */
export function foldLine(line: string): string {
  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = Buffer.byteLength(ch)
    const limit = parts.length === 0 ? 75 : 74 // continuation lines start with a space
    if (bytes + size > limit) {
      parts.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  parts.push(current)
  return parts.join('\r\n ')
}

const compactDate = (iso: string) => iso.replace(/-/g, '')
const localDateTime = (date: string, hhmm: string) => `${compactDate(date)}T${hhmm.replace(':', '')}00`
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const addMinutes = (hhmm: string, m: number) => {
  const t = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) + m
  return `${String(Math.min(Math.floor(t / 60), 23)).padStart(2, '0')}:${String(t >= 24 * 60 ? 59 : t % 60).padStart(2, '0')}`
}

/** Central European zones share one rule set; other zones are referenced by TZID only (clients resolve IANA names). */
const CET_ZONES = new Set([
  'Europe/Zurich', 'Europe/Berlin', 'Europe/Vienna', 'Europe/Paris', 'Europe/Rome', 'Europe/Amsterdam',
  'Europe/Brussels', 'Europe/Luxembourg', 'Europe/Madrid', 'Europe/Prague', 'Europe/Stockholm', 'Europe/Oslo',
  'Europe/Copenhagen', 'Europe/Warsaw', 'Europe/Budapest', 'Europe/Vaduz', 'Europe/Ljubljana', 'Europe/Zagreb',
])
const vtimezone = (tz: string) =>
  CET_ZONES.has(tz)
    ? [
        'BEGIN:VTIMEZONE', `TZID:${tz}`,
        'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
        'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
        'END:VTIMEZONE',
      ]
    : []

export function buildIcs(input: ExportInput): string {
  const { timezone: tz } = input
  const stamp = `DTSTAMP:${utcStamp(input.now ?? new Date())}`
  const subjectById = new Map(input.subjects.map((s) => [s.id, s]))
  const out: string[] = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//calendar-gm//Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Calendar', `X-WR-TIMEZONE:${tz}`,
    ...vtimezone(tz),
  ]
  const dt = (name: string, date: string, hhmm: string) => `${name};TZID=${tz}:${localDateTime(date, hhmm)}`

  // --- weekly lessons: one recurring VEVENT per slot and term
  for (const slot of input.slots) {
    const term = input.terms.find((t) => t.id === slot.termId)
    const subject = subjectById.get(slot.subjectId)
    if (!term || !subject) continue
    let first = term.startDate
    while (isoWeekday(first) !== slot.weekday) first = addDays(first, 1)
    if (first > term.endDate) continue

    const uid = `lesson-${slot.id}@calendar-gm`
    // Occurrence dates to skip: holidays and cancelled lessons
    const skip = new Set<string>()
    for (let d = first; d <= term.endDate; d = addDays(d, 7)) {
      if (input.holidays.some((h) => h.startDate <= d && d <= h.endDate)) skip.add(d)
    }
    const slotExceptions = input.exceptions.filter((e) => e.slotId === slot.id)
    for (const e of slotExceptions) if (e.kind === 'cancelled') skip.add(e.date)

    out.push(
      'BEGIN:VEVENT', `UID:${uid}`, stamp,
      dt('DTSTART', first, slot.startTime), dt('DTEND', first, slot.endTime),
      `RRULE:FREQ=WEEKLY;UNTIL=${compactDate(term.endDate)}T235959Z`,
      ...[...skip].sort().map((d) => dt('EXDATE', d, slot.startTime)),
      `SUMMARY:${escapeText(subject.name)}`,
      ...(slot.room ? [`LOCATION:${escapeText(slot.room)}`] : []),
      ...(subject.teacher ? [`DESCRIPTION:${escapeText(subject.teacher)}`] : []),
      'CATEGORIES:Lesson',
      'END:VEVENT',
    )
    // Changed lessons: an override instance for that one date
    for (const e of slotExceptions.filter((x) => x.kind === 'changed' && !skip.has(x.date))) {
      out.push(
        'BEGIN:VEVENT', `UID:${uid}`, stamp,
        dt('RECURRENCE-ID', e.date, slot.startTime),
        dt('DTSTART', e.date, e.newStartTime ?? slot.startTime), dt('DTEND', e.date, e.newEndTime ?? slot.endTime),
        `SUMMARY:${escapeText(subject.name)}`,
        ...((e.newRoom ?? slot.room) ? [`LOCATION:${escapeText((e.newRoom ?? slot.room)!)}`] : []),
        ...(e.note ? [`DESCRIPTION:${escapeText(e.note)}`] : []),
        'CATEGORIES:Lesson,Changed',
        'END:VEVENT',
      )
    }
  }

  // --- events (exams, appointments, …)
  for (const e of input.events) {
    const last = e.endDate ?? e.date
    const timing =
      e.allDay || !e.startTime
        ? [`DTSTART;VALUE=DATE:${compactDate(e.date)}`, `DTEND;VALUE=DATE:${compactDate(addDays(last, 1))}`]
        : [dt('DTSTART', e.date, e.startTime), dt('DTEND', last, e.endTime ?? addMinutes(e.startTime, 30))]
    const description = [e.topics && `Topics: ${e.topics}`, e.notes].filter(Boolean).join('\n')
    const categories = [...(e.kind === 'other' ? [] : [EVENT_KIND_LABELS[e.kind]]), ...e.tags].map(escapeText)
    out.push(
      'BEGIN:VEVENT', `UID:${e.id}@calendar-gm`, stamp, ...timing,
      `SUMMARY:${escapeText(e.title)}`,
      ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
      ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
      ...(categories.length ? [`CATEGORIES:${categories.join(',')}`] : []),
      'END:VEVENT',
    )
  }

  out.push('END:VCALENDAR')
  return out.map(foldLine).join('\r\n') + '\r\n'
}
