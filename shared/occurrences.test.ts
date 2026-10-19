import { describe, expect, it } from 'vitest'
import { addDays, isoWeekNumber, isoWeekday, startOfIsoWeek } from './dates.js'
import { expandLessons } from './occurrences.js'
import type { Holiday, LessonException, LessonSlot, Term } from './types.js'

const term: Term = { id: 't1', name: 'Autumn term', startDate: '2026-08-17', endDate: '2026-12-23' }
const mondayMaths: LessonSlot = {
  id: 's1', subjectId: 'maths', termId: 't1', weekday: 1, startTime: '09:20', endTime: '10:55', room: 'A112', teacher: null,
}
const wednesdayGerman: LessonSlot = {
  id: 's2', subjectId: 'german', termId: 't1', weekday: 3, startTime: '10:10', endTime: '10:55', room: 'A207', teacher: null,
}
const base = { slots: [mondayMaths, wednesdayGerman], terms: [term], holidays: [] as Holiday[], exceptions: [] as LessonException[] }

describe('date helpers', () => {
  it('knows ISO weekdays and week starts', () => {
    expect(isoWeekday('2026-10-19')).toBe(1) // Monday
    expect(isoWeekday('2026-10-25')).toBe(7) // Sunday
    expect(startOfIsoWeek('2026-10-25')).toBe('2026-10-19')
    expect(isoWeekNumber('2026-10-19')).toBe(43)
    expect(isoWeekNumber('2027-01-01')).toBe(53) // 2026 has 53 ISO weeks
  })

  it('adds days across the DST change and month ends', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26') // Europe falls back on 25 Oct
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30') // springs forward on 29 Mar
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('expandLessons', () => {
  it('repeats each slot weekly on its weekday', () => {
    const out = expandLessons({ ...base, from: '2026-10-19', to: '2026-11-01' })
    expect(out.map((o) => `${o.date} ${o.subjectId}`)).toEqual([
      '2026-10-19 maths',
      '2026-10-21 german',
      '2026-10-26 maths',
      '2026-10-28 german',
    ])
    expect(out[0]).toMatchObject({ startTime: '09:20', endTime: '10:55', room: 'A112', status: 'scheduled' })
  })

  it('keeps the wall-clock time across the DST change', () => {
    const out = expandLessons({ ...base, from: '2026-10-26', to: '2026-10-26' })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ date: '2026-10-26', startTime: '09:20' })
  })

  it('only produces lessons inside the term (boundaries inclusive)', () => {
    const shortTerm: Term = { ...term, startDate: '2026-10-21', endDate: '2026-10-26' }
    const out = expandLessons({ ...base, terms: [shortTerm], from: '2026-10-12', to: '2026-11-08' })
    expect(out.map((o) => o.date)).toEqual(['2026-10-21', '2026-10-26'])
  })

  it('skips slots whose term is unknown', () => {
    const orphan = { ...mondayMaths, id: 's9', termId: 'missing' }
    expect(expandLessons({ ...base, slots: [orphan], from: '2026-10-19', to: '2026-10-25' })).toEqual([])
  })

  it('skips holidays, including both boundary days', () => {
    const autumn: Holiday = { id: 'h1', name: 'Autumn holidays', startDate: '2026-10-05', endDate: '2026-10-19' }
    const out = expandLessons({ ...base, holidays: [autumn], from: '2026-10-05', to: '2026-10-21' })
    expect(out.map((o) => o.date)).toEqual(['2026-10-21']) // 5 Oct and 19 Oct (Mondays) are holidays
  })

  it('marks a cancelled lesson for that date only', () => {
    const cancelled: LessonException = {
      id: 'e1', slotId: 's1', date: '2026-10-19', kind: 'cancelled', newStartTime: null, newEndTime: null, newRoom: null, note: 'Teacher ill',
    }
    const out = expandLessons({ ...base, exceptions: [cancelled], from: '2026-10-19', to: '2026-10-26' })
    const maths = out.filter((o) => o.subjectId === 'maths')
    expect(maths.map((o) => [o.date, o.status])).toEqual([
      ['2026-10-19', 'cancelled'],
      ['2026-10-26', 'scheduled'],
    ])
    expect(maths[0].note).toBe('Teacher ill')
  })

  it('applies a changed room/time to one occurrence', () => {
    const moved: LessonException = {
      id: 'e2', slotId: 's2', date: '2026-10-21', kind: 'changed', newStartTime: '11:05', newEndTime: '11:50', newRoom: 'B204', note: null,
    }
    const out = expandLessons({ ...base, exceptions: [moved], from: '2026-10-21', to: '2026-10-28' }).filter(
      (o) => o.subjectId === 'german',
    )
    expect(out[0]).toMatchObject({ date: '2026-10-21', status: 'changed', startTime: '11:05', endTime: '11:50', room: 'B204' })
    expect(out[1]).toMatchObject({ date: '2026-10-28', status: 'scheduled', startTime: '10:10', room: 'A207' })
  })

  it('a changed exception with only a new room keeps the original times', () => {
    const roomOnly: LessonException = {
      id: 'e3', slotId: 's1', date: '2026-10-19', kind: 'changed', newStartTime: null, newEndTime: null, newRoom: 'Aula', note: null,
    }
    const [o] = expandLessons({ ...base, exceptions: [roomOnly], from: '2026-10-19', to: '2026-10-19' })
    expect(o).toMatchObject({ startTime: '09:20', endTime: '10:55', room: 'Aula', status: 'changed' })
  })

  it('returns an empty list for an inverted range', () => {
    expect(expandLessons({ ...base, from: '2026-10-25', to: '2026-10-19' })).toEqual([])
  })

  it('sorts by date, then start time', () => {
    const early = { ...mondayMaths, id: 's3', subjectId: 'informatics', startTime: '07:30', endTime: '09:05' }
    const out = expandLessons({ ...base, slots: [mondayMaths, early], from: '2026-10-19', to: '2026-10-19' })
    expect(out.map((o) => o.startTime)).toEqual(['07:30', '09:20'])
  })
})
