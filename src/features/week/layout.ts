import { ASSESSED_KINDS, EVENT_KIND_LABELS, PERSONAL_KINDS } from '../../../shared/constants'
import { toMinutes } from '../../../shared/dates'
import type { LessonOccurrence } from '../../../shared/occurrences'
import type { CalendarEvent, Subject } from '../../../shared/types'
import type { BlockVariant } from '../../components/Block'

export interface GridItem {
  key: string
  date: string
  start: number // minutes since midnight
  end: number
  variant: BlockVariant
  color: Subject['color'] | null
  title: string
  meta: string
  /** Built-in tag first (Lesson, Exam…), then the user's own tags. */
  tags: string[]
  /** Set for events (clicking opens the editor). */
  eventId?: string
  /** Set for lessons (clicking lets you cancel/change this one date). */
  lesson?: LessonOccurrence
  /** filled in by layoutColumns */
  col: number
  cols: number
}

const timeRange = (s: string, e: string) => `${s}–${e}`
const joinMeta = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ')

export function lessonItem(l: LessonOccurrence, subject: Subject | undefined): GridItem {
  const base = {
    key: `l:${l.slotId}:${l.date}`,
    date: l.date,
    start: toMinutes(l.startTime),
    end: toMinutes(l.endTime),
    color: subject?.color ?? null,
    title: subject?.name ?? 'Lesson',
    lesson: l,
    col: 0,
    cols: 1,
  }
  if (l.status === 'cancelled') return { ...base, variant: 'cancelled', tags: ['Lesson'], meta: joinMeta('Cancelled', l.startTime, l.note) }
  if (l.status === 'changed')
    return { ...base, variant: 'tagged', tags: ['Changed', 'Lesson'], meta: joinMeta(timeRange(l.startTime, l.endTime), l.room) }
  return { ...base, variant: 'lesson', tags: ['Lesson'], meta: joinMeta(timeRange(l.startTime, l.endTime), l.room) }
}

export function eventItem(e: CalendarEvent, subject: Subject | undefined): GridItem | null {
  if (e.allDay || !e.startTime || isMultiDay(e)) return null
  const end = e.endTime ?? e.startTime
  const color = subject?.color ?? null
  const assessed = ASSESSED_KINDS.includes(e.kind)
  const personal = PERSONAL_KINDS.includes(e.kind)
  const variant: BlockVariant = assessed && color ? 'assessed' : personal || !color ? 'personal' : 'tagged'
  return {
    key: `e:${e.id}`,
    eventId: e.id,
    date: e.date,
    start: toMinutes(e.startTime),
    end: Math.max(toMinutes(end), toMinutes(e.startTime) + 30),
    variant,
    color,
    title: e.title,
    meta: joinMeta(timeRange(e.startTime, end), e.location),
    tags: [...(e.kind === 'other' ? [] : [EVENT_KIND_LABELS[e.kind]]), ...e.tags],
    col: 0,
    cols: 1,
  }
}

/** An exam/test in the same subject during a lesson replaces that lesson in the grid. */
export function hideReplacedLessons(lessons: LessonOccurrence[], events: CalendarEvent[]) {
  return lessons.filter(
    (l) =>
      !events.some(
        (e) =>
          ASSESSED_KINDS.includes(e.kind) &&
          e.subjectId === l.subjectId &&
          e.date === l.date &&
          e.startTime !== null &&
          toMinutes(e.startTime) < toMinutes(l.endTime) &&
          toMinutes(e.endTime ?? e.startTime) > toMinutes(l.startTime),
      ),
  )
}

/** Side-by-side columns for overlapping items within one day (greedy, per overlap cluster). */
export function layoutColumns(items: GridItem[]): GridItem[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)
  const out: GridItem[] = []
  let cluster: GridItem[] = []
  let clusterEnd = -1
  const flush = () => {
    const colEnds: number[] = []
    for (const item of cluster) {
      let col = colEnds.findIndex((end) => end <= item.start)
      if (col === -1) col = colEnds.push(0) - 1
      colEnds[col] = item.end
      item.col = col
    }
    for (const item of cluster) item.cols = colEnds.length
    out.push(...cluster)
    cluster = []
  }
  for (const item of sorted) {
    if (cluster.length && item.start >= clusterEnd) flush()
    cluster.push({ ...item })
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  flush()
  return out
}

/** Multi-day events live in the all-day row, not the time grid. */
export const isMultiDay = (e: Pick<CalendarEvent, 'date' | 'endDate'>) => !!e.endDate && e.endDate > e.date

// ---------------------------------------------------------------------------
// All-day row: bars spanning day columns, stacked into lanes
// ---------------------------------------------------------------------------

/** Put each [from, to] span (inclusive column indexes) in the first lane where it doesn't overlap. */
export function assignLanes<T extends { from: number; to: number }>(items: T[]): (T & { lane: number })[] {
  const sorted = [...items].sort((a, b) => a.from - b.from || b.to - b.from - (a.to - a.from))
  const laneEnds: number[] = []
  return sorted.map((item) => {
    let lane = laneEnds.findIndex((end) => end < item.from)
    if (lane === -1) lane = laneEnds.push(-1) - 1
    laneEnds[lane] = item.to
    return { ...item, lane }
  })
}

// ---------------------------------------------------------------------------
// Drag & drop in the time grid (minutes since midnight, 15-minute steps)
// ---------------------------------------------------------------------------

export const SNAP_MIN = 15
const DAY_END = 24 * 60
const snap = (m: number) => Math.round(m / SNAP_MIN) * SNAP_MIN

/** Move an event by `delta` minutes: snapped, same duration, kept inside the day. */
export function moveTimes(start: number, end: number, delta: number) {
  const duration = end - start
  const s = Math.min(Math.max(snap(start + delta), 0), DAY_END - duration)
  return { start: s, end: s + duration }
}

/** Drag the bottom edge by `delta` minutes: snapped, at least one step long, not past midnight. */
export function resizeEnd(start: number, end: number, delta: number) {
  return { start, end: Math.min(Math.max(snap(end + delta), start + SNAP_MIN), DAY_END) }
}

/** Create-by-drag: from where you pressed to where you are, at least one step, in either direction. */
export function selection(a: number, b: number) {
  const s = snap(Math.min(a, b))
  const e = Math.max(snap(Math.max(a, b)), s + SNAP_MIN)
  return { start: Math.max(s, 0), end: Math.min(e, DAY_END) }
}
