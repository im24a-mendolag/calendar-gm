import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../../shared/types.js'
import { buildIcs, escapeText, foldLine } from './icsExport.js'
import { guessKind, parseIcs } from './icsImport.js'

const tz = 'Europe/Zurich'
const maths = { id: 'm', name: 'Maths', color: 'blue' as const, teacher: 'Keller', defaultRoom: 'A112' }
const german = { id: 'g', name: 'German', color: 'orange' as const, teacher: null, defaultRoom: null }
const term = { id: 't', name: 'Autumn term', startDate: '2026-10-05', endDate: '2026-11-08' }
const holiday = { id: 'h', name: 'Autumn holidays', startDate: '2026-10-10', endDate: '2026-10-18' }
const event = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'e1', kind: 'exam', title: 'Maths', subjectId: 'm', date: '2026-10-21', endDate: null, startTime: '08:20', endTime: '09:50',
  allDay: false, location: 'A112', topics: 'Linear functions', notes: null, reminderDays: 3, tags: ['Graded'], tagIds: ['x'], ...over,
})

const input = {
  timezone: tz,
  subjects: [maths, german],
  terms: [term],
  holidays: [holiday],
  slots: [
    { id: 's1', subjectId: 'm', termId: 't', weekday: 1, startTime: '09:20', endTime: '10:55', room: 'A112' },
    { id: 's2', subjectId: 'g', termId: 't', weekday: 3, startTime: '10:10', endTime: '10:55', room: 'A207' },
  ],
  exceptions: [
    { id: 'x1', slotId: 's1', date: '2026-10-26', kind: 'changed' as const, newStartTime: null, newEndTime: null, newRoom: 'Aula', note: 'Room change' },
    { id: 'x2', slotId: 's2', date: '2026-10-21', kind: 'cancelled' as const, newStartTime: null, newEndTime: null, newRoom: null, note: null },
  ],
  events: [
    event({}),
    event({ id: 'e2', kind: 'other', title: 'Ski camp; Davos, Grisons', subjectId: null, date: '2026-10-28', endDate: '2026-10-30', allDay: true, startTime: null, endTime: null, location: null, topics: null, tags: [] }),
  ],
  now: new Date('2026-10-19T10:00:00Z'),
}

describe('ics text helpers', () => {
  it('escapes separators and newlines', () => {
    expect(escapeText('a;b,c\\d\ne')).toBe('a\\;b\\,c\\\\d\\ne')
  })
  it('folds long lines at 75 octets without splitting characters', () => {
    const line = 'DESCRIPTION:' + 'ä'.repeat(60)
    const folded = foldLine(line)
    for (const part of folded.split('\r\n')) expect(Buffer.byteLength(part)).toBeLessThanOrEqual(75)
    expect(folded.replace(/\r\n /g, '')).toBe(line)
  })
})

describe('buildIcs', () => {
  const ics = buildIcs(input)
  it('writes one weekly series per slot with holidays and cancellations as EXDATE', () => {
    expect(ics).toContain('UID:lesson-s1@calendar-gm')
    expect(ics).toContain(`DTSTART;TZID=${tz}:20261005T092000`)
    expect(ics).toContain('RRULE:FREQ=WEEKLY;UNTIL=20261108T235959Z')
    expect(ics).toContain(`EXDATE;TZID=${tz}:20261012T092000`) // holiday Monday
    expect(ics).toContain(`EXDATE;TZID=${tz}:20261021T101000`) // cancelled German
    expect(ics).toContain('BEGIN:VTIMEZONE')
  })
  it('writes a changed lesson as an override instance', () => {
    expect(ics).toContain(`RECURRENCE-ID;TZID=${tz}:20261026T092000`)
    expect(ics).toContain('LOCATION:Aula')
  })
  it('writes events with categories and all-day/multi-day dates', () => {
    expect(ics).toContain('CATEGORIES:Exam,Graded')
    expect(ics).toContain('DTSTART;VALUE=DATE:20261028')
    expect(ics).toContain('DTEND;VALUE=DATE:20261031') // exclusive end
    expect(ics).toContain('SUMMARY:Ski camp\\; Davos\\, Grisons')
  })
})

describe('parseIcs', () => {
  it('round-trips our own export', () => {
    const { events, truncated } = parseIcs(buildIcs(input), { timezone: tz, from: '2026-10-01', to: '2026-11-30', subjects: [maths, german] })
    expect(truncated).toBe(false)
    const mathsLessons = events.filter((e) => e.icsUid.startsWith('lesson-s1')).map((e) => `${e.date} ${e.startTime} ${e.location}`)
    // 5 Oct … 2 Nov, minus the holiday Monday (12 Oct); 26 Oct moved to the Aula
    expect(mathsLessons).toEqual(['2026-10-05 09:20 A112', '2026-10-19 09:20 A112', '2026-10-26 09:20 Aula', '2026-11-02 09:20 A112'])
    const germanDates = events.filter((e) => e.icsUid.startsWith('lesson-s2')).map((e) => e.date)
    expect(germanDates).not.toContain('2026-10-21') // cancelled
    expect(germanDates).not.toContain('2026-10-14') // holiday

    const exam = events.find((e) => e.icsUid === 'e1@calendar-gm')!
    expect(exam).toMatchObject({ kind: 'exam', subjectId: 'm', date: '2026-10-21', startTime: '08:20', endTime: '09:50', location: 'A112' })
    const ski = events.find((e) => e.icsUid === 'e2@calendar-gm')!
    expect(events.filter((e) => e.icsUid.startsWith('lesson-')).every((e) => e.kind === 'other')).toBe(true) // 'Lesson' isn't an event kind
    expect(ski).toMatchObject({ title: 'Ski camp; Davos, Grisons', allDay: true, date: '2026-10-28', endDate: '2026-10-30', startTime: null })
  })

  it('converts UTC times into the user timezone and keeps recurring UIDs unique per occurrence', () => {
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0',
      'BEGIN:VEVENT', 'UID:abc', 'DTSTART:20261023T120000Z', 'DTEND:20261023T130000Z', 'SUMMARY:Prüfung Englisch', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:weekly', 'DTSTART:20261026T060000Z', 'DTEND:20261026T064500Z', 'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:Sport', 'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const { events } = parseIcs(ics, { timezone: tz, from: '2026-10-01', to: '2026-12-31' })
    expect(events.find((e) => e.icsUid === 'abc')).toMatchObject({ kind: 'exam', startTime: '14:00', endTime: '15:00' }) // CEST +2
    const weekly = events.filter((e) => e.icsUid.startsWith('weekly|'))
    expect(weekly.map((e) => `${e.date} ${e.startTime}`)).toEqual(['2026-10-26 07:00', '2026-11-02 07:00', '2026-11-09 07:00']) // CET +1
    expect(new Set(weekly.map((e) => e.icsUid)).size).toBe(3)
  })

  it('only keeps events inside the window', () => {
    const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:old', 'DTSTART;VALUE=DATE:20200101', 'SUMMARY:Old', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
    expect(parseIcs(ics, { timezone: tz, from: '2026-01-01', to: '2026-12-31' }).events).toEqual([])
  })
})

describe('guessKind', () => {
  it('recognises exams, tests and presentations in German and English', () => {
    expect(guessKind('Mathe Prüfung')).toBe('exam')
    expect(guessKind('Lernkontrolle Französisch')).toBe('test')
    expect(guessKind('Präsentation M164')).toBe('presentation')
    expect(guessKind('Football')).toBe('other')
  })
})
