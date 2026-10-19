// iCalendar import via ical.js (handles RRULE expansion, exceptions and VTIMEZONE).
import ICAL from 'ical.js'
import { EVENT_KINDS, EVENT_KIND_LABELS, type EventKind } from '../../shared/constants.js'
import { addDays } from '../../shared/dates.js'

export interface ImportedEvent {
  /** Stable per occurrence: UID, plus the occurrence start for recurring events. */
  icsUid: string
  kind: EventKind
  title: string
  subjectId: string | null
  date: string
  endDate: string | null
  allDay: boolean
  startTime: string | null
  endTime: string | null
  location: string | null
  notes: string | null
}

export interface ImportResult {
  events: ImportedEvent[]
  /** Recurring series cut off at the window/limit. */
  truncated: boolean
}

const MAX_OCCURRENCES = 2000

/** Guess the built-in kind from the title (school portals often export exams as plain events). */
export function guessKind(title: string): EventKind {
  if (/\b(prüfung|pruefung|exam|examen|klausur|matura)\b/i.test(title)) return 'exam'
  if (/\b(test|lernkontrolle|quiz)\b/i.test(title)) return 'test'
  if (/\b(präsentation|praesentation|presentation|vortrag|referat)\b/i.test(title)) return 'presentation'
  if (/\b(abgabe|deadline|due)\b/i.test(title)) return 'deadline'
  return 'other'
}

/** A built-in kind named in CATEGORIES (e.g. our own export writes "Exam"). */
function kindFromCategories(comp: ICAL.Component): EventKind | null {
  const values = comp.getAllProperties('categories').flatMap((p) => p.getValues().map(String))
  const byLabel = new Map(EVENT_KINDS.map((k) => [EVENT_KIND_LABELS[k].toLowerCase(), k]))
  for (const v of values) {
    const k = byLabel.get(v.trim().toLowerCase())
    if (k && k !== 'other') return k
  }
  return null
}

const pad = (n: number) => String(n).padStart(2, '0')

/** An ICAL.Time as local date (+ time) in `tz`. All-day values and floating times are taken as written. */
function toLocal(t: ICAL.Time, tz: string): { date: string; time: string | null } {
  if (t.isDate) return { date: `${t.year}-${pad(t.month)}-${pad(t.day)}`, time: null }
  if (!t.zone || t.zone.tzid === 'floating') return { date: `${t.year}-${pad(t.month)}-${pad(t.day)}`, time: `${pad(t.hour)}:${pad(t.minute)}` }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(t.toJSDate())
      .map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

function toImported(
  uid: string,
  summary: string,
  location: string | null,
  description: string | null,
  start: ICAL.Time,
  end: ICAL.Time | null,
  tz: string,
  subjects: { id: string; name: string }[],
  categoryKind: EventKind | null,
): ImportedEvent {
  const s = toLocal(start, tz)
  const allDay = start.isDate
  let endDate: string | null = null
  let endTime: string | null = null
  if (end) {
    const e = toLocal(end, tz)
    // DTEND of all-day events is exclusive (the day after)
    const last = allDay ? addDays(e.date, -1) : e.date
    endDate = last > s.date ? last : null
    endTime = allDay ? null : e.time
  }
  const title = summary.trim() || '(no title)'
  const subject = subjects.find((sub) => new RegExp(`\\b${sub.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(title))
  return {
    icsUid: uid,
    kind: categoryKind ?? guessKind(title),
    title: title.slice(0, 100),
    subjectId: subject?.id ?? null,
    date: s.date,
    endDate,
    allDay,
    startTime: s.time,
    endTime: endTime && (endDate || endTime > (s.time ?? '')) ? endTime : null,
    location: location?.slice(0, 200) || null,
    notes: description?.slice(0, 2000) || null,
  }
}

/**
 * Parse an .ics file into events. Recurring series are expanded into single events
 * between `from` and `to` (dates, inclusive), at most MAX_OCCURRENCES in total.
 */
export function parseIcs(
  text: string,
  opts: { timezone: string; from: string; to: string; subjects?: { id: string; name: string }[] },
): ImportResult {
  const root = new ICAL.Component(ICAL.parse(text))
  for (const vtz of root.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(vtz)

  const vevents = root.getAllSubcomponents('vevent')
  const masters = vevents.filter((v) => !v.hasProperty('recurrence-id'))
  const overrides = vevents.filter((v) => v.hasProperty('recurrence-id'))
  const subjects = opts.subjects ?? []
  const out: ImportedEvent[] = []
  let truncated = false
  const inWindow = (date: string) => date >= opts.from && date <= opts.to

  for (const comp of masters) {
    const event = new ICAL.Event(comp)
    if (!event.uid || !event.startDate) continue
    for (const o of overrides) if (o.getFirstPropertyValue('uid') === event.uid) event.relateException(o)

    if (!event.isRecurring()) {
      const item = toImported(event.uid, event.summary ?? '', event.location, event.description, event.startDate, event.endDate, opts.timezone, subjects, kindFromCategories(comp))
      if (item.date <= opts.to && (item.endDate ?? item.date) >= opts.from) out.push(item)
      continue
    }

    const it = event.iterator()
    for (let next = it.next(); next; next = it.next()) {
      const details = event.getOccurrenceDetails(next)
      const occ = toImported(
        `${event.uid}|${next.toString()}`,
        details.item.summary ?? '',
        details.item.location,
        details.item.description,
        details.startDate,
        details.endDate,
        opts.timezone,
        subjects,
        kindFromCategories(details.item.component),
      )
      if (occ.date > opts.to) break
      if (!inWindow(occ.date)) continue
      if (out.length >= MAX_OCCURRENCES) {
        truncated = true
        break
      }
      out.push(occ)
    }
  }
  return { events: out, truncated }
}
