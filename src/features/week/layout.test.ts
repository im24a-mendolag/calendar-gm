import { describe, expect, it } from 'vitest'
import type { LessonOccurrence } from '../../../shared/occurrences'
import type { CalendarEvent } from '../../../shared/types'
import { assignLanes, eventItem, hideReplacedLessons, layoutColumns, lessonItem, moveTimes, resizeEnd, selection, type GridItem } from './layout'

const item = (key: string, start: number, end: number): GridItem => ({
  key, date: '2026-10-19', start, end, variant: 'lesson', color: 'blue', title: key, meta: '', tags: ['Lesson'], col: 0, cols: 1,
})

const lesson = (subjectId: string, startTime: string, endTime: string): LessonOccurrence => ({
  slotId: subjectId, subjectId, date: '2026-10-21', startTime, endTime, room: null, status: 'scheduled', note: null,
})

const event = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'e', kind: 'exam', title: 'Maths exam', subjectId: 'maths', date: '2026-10-21', endDate: null, startTime: '08:20', endTime: '09:50',
  allDay: false, location: null, topics: null, notes: null, reminderDays: null, tags: [], tagIds: [], ...over,
})

describe('layoutColumns', () => {
  it('keeps non-overlapping items full width', () => {
    const out = layoutColumns([item('a', 0, 60), item('b', 60, 120)])
    expect(out.map((i) => [i.key, i.col, i.cols])).toEqual([['a', 0, 1], ['b', 0, 1]])
  })

  it('puts overlapping items side by side', () => {
    const out = layoutColumns([item('a', 0, 90), item('b', 30, 60), item('c', 100, 120)])
    expect(out.map((i) => [i.key, i.col, i.cols])).toEqual([['a', 0, 2], ['b', 1, 2], ['c', 0, 1]])
  })

  it('reuses a free column inside a cluster', () => {
    const out = layoutColumns([item('a', 0, 120), item('b', 0, 30), item('c', 40, 60)])
    expect(out.map((i) => [i.key, i.col, i.cols])).toEqual([['a', 0, 2], ['b', 1, 2], ['c', 1, 2]])
  })
})

describe('hideReplacedLessons', () => {
  it('hides a lesson when an exam in the same subject overlaps it', () => {
    const lessons = [lesson('maths', '08:20', '10:05'), lesson('german', '10:10', '10:55')]
    expect(hideReplacedLessons(lessons, [event({})]).map((l) => l.subjectId)).toEqual(['german'])
  })

  it('keeps the lesson for personal events or other subjects', () => {
    const lessons = [lesson('maths', '08:20', '10:05')]
    expect(hideReplacedLessons(lessons, [event({ kind: 'appointment', subjectId: null })])).toHaveLength(1)
    expect(hideReplacedLessons(lessons, [event({ subjectId: 'english' })])).toHaveLength(1)
  })
})

describe('eventItem', () => {
  it('styles exams solid, personal events neutral, and skips all-day events', () => {
    expect(eventItem(event({}), { id: 'maths', name: 'Maths', color: 'blue', teacher: null, defaultRoom: null })).toMatchObject({
      variant: 'assessed', tags: ['Exam'], meta: '08:20–09:50',
    })
    expect(eventItem(event({ kind: 'interview', subjectId: null, title: 'Job interview' }), undefined)).toMatchObject({
      variant: 'personal', tags: ['Interview'],
    })
    expect(eventItem(event({ allDay: true }), undefined)).toBeNull()
  })

  it('puts the built-in tag first, then the user tags; "other" has no built-in tag', () => {
    expect(eventItem(event({ tags: ['Formula sheet', 'Graded'] }), undefined)?.tags).toEqual(['Exam', 'Formula sheet', 'Graded'])
    expect(eventItem(event({ kind: 'other', tags: ['Online'] }), undefined)?.tags).toEqual(['Online'])
  })
})

describe('lessonItem', () => {
  const lessonOcc = (status: LessonOccurrence['status']): LessonOccurrence => ({ ...lesson('maths', '09:20', '10:55'), status })
  it('tags every lesson; a changed one leads with Changed (the part that matters)', () => {
    expect(lessonItem(lessonOcc('scheduled'), undefined).tags).toEqual(['Lesson'])
    expect(lessonItem(lessonOcc('changed'), undefined).tags).toEqual(['Changed', 'Lesson'])
    expect(lessonItem(lessonOcc('cancelled'), undefined)).toMatchObject({ variant: 'cancelled', tags: ['Lesson'] })
  })
})

describe('assignLanes', () => {
  it('stacks overlapping spans and reuses free lanes', () => {
    const out = assignLanes([
      { key: 'trip', from: 0, to: 4 },
      { key: 'hw-tue', from: 1, to: 1 },
      { key: 'hw-wed', from: 2, to: 2 },
      { key: 'deadline-fri', from: 4, to: 4 },
    ])
    const lane = Object.fromEntries(out.map((o) => [o.key, o.lane]))
    expect(lane).toEqual({ trip: 0, 'hw-tue': 1, 'hw-wed': 1, 'deadline-fri': 1 })
  })
  it('puts longer spans first when they start on the same day', () => {
    const out = assignLanes([{ key: 'short', from: 0, to: 0 }, { key: 'long', from: 0, to: 3 }])
    expect(out.find((o) => o.key === 'long')!.lane).toBe(0)
  })
})

describe('drag math', () => {
  it('moves in 15-minute steps and keeps the duration', () => {
    expect(moveTimes(930, 975, 37)).toEqual({ start: 960, end: 1005 }) // 15:30–16:15 dragged 37 min → 16:00–16:45
    expect(moveTimes(930, 975, -7)).toEqual({ start: 930, end: 975 })
  })
  it('never moves past the start or end of the day', () => {
    expect(moveTimes(30, 90, -120)).toEqual({ start: 0, end: 60 })
    expect(moveTimes(1380, 1440, 120)).toEqual({ start: 1380, end: 1440 })
  })
  it('resizes the end, at least one step long', () => {
    expect(resizeEnd(600, 660, 22)).toEqual({ start: 600, end: 675 }) // 11:22 snaps to 11:15
    expect(resizeEnd(600, 660, 25)).toEqual({ start: 600, end: 690 }) // 11:25 snaps to 11:30
    expect(resizeEnd(600, 660, -300)).toEqual({ start: 600, end: 615 })
  })
  it('selects a range by dragging up or down', () => {
    expect(selection(600, 692)).toEqual({ start: 600, end: 690 })
    expect(selection(692, 600)).toEqual({ start: 600, end: 690 })
    expect(selection(600, 601)).toEqual({ start: 600, end: 615 })
  })
})
