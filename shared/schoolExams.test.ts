import { describe, expect, it } from 'vitest'
import { parseSchoolExams, suggestSubject } from './schoolExams.js'

// Rows as copied from the school portal (teacher names replaced). First row has no leading tab, the rest do.
const sample = [
  '31.08. - 06.09.26 (Woche 36)\tDonnerstag (3.9.)\t12:35:00\t13:20:00\tM\tTeacher A\tI24a\t211\t\t\t \tI24a (1 Lektion)',
  '\t07.09. - 13.09.26 (Woche 37)\tMontag (7.9.)\t08:40:00\t09:25:00\tD\tTeacher B\tI24a\t308\t\t\t \tI24a (1 Lektion)',
  '\t21.09. - 27.09.26 (Woche 39)\tFreitag (25.9.)\t13:30:00\t14:15:00\tE\tTeacher C,Teacher D\tI24a\t203\tListening\t\t \tI24a (1 Lektion)',
  '\t09.11. - 15.11.26 (Woche 46)\tMontag (9.11.)\t09:35:00\t11:25:00\tM\tTeacher A\tI24a\t208\t\t\t \tI24a (2 Lektionen)',
  '\t14.12. - 20.12.26 (Woche 51)\tMontag (14.12.)\t12:35:00\t13:20:00\tF\tTeacher E\tI24a\t204\tExamen écrit\t\t \tI24a (1 Lektion)',
  '\t18.01. - 24.01.27 (Woche 3)\tFreitag (22.1.)\t09:35:00\t12:20:00\tD\tTeacher B\tI24a\tf1\t\t\t \tI24a (3 Lektionen)',
].join('\n')

describe('parseSchoolExams', () => {
  const { exams, skipped } = parseSchoolExams(sample)

  it('reads every row, with dates, times, code, room and note', () => {
    expect(skipped).toEqual([])
    expect(exams).toHaveLength(6)
    expect(exams[0]).toEqual({
      key: 'school:2026-09-03|12:35|M', date: '2026-09-03', startTime: '12:35', endTime: '13:20',
      code: 'M', teachers: 'Teacher A', room: '211', note: null,
    })
    expect(exams[2]).toMatchObject({ date: '2026-09-25', code: 'E', teachers: 'Teacher C,Teacher D', room: '203', note: 'Listening' })
    expect(exams[3]).toMatchObject({ date: '2026-11-09', startTime: '09:35', endTime: '11:25' }) // double lesson
    expect(exams[4]).toMatchObject({ code: 'F', note: 'Examen écrit' })
  })

  it('takes the year from the week range, including after new year', () => {
    expect(exams[5]).toMatchObject({ date: '2027-01-22', room: 'f1', startTime: '09:35', endTime: '12:20' })
  })

  it('handles a week that spans new year', () => {
    const { exams: e } = parseSchoolExams('28.12. - 03.01.27 (Woche 53)\tMontag (28.12.)\t08:40:00\t09:25:00\tM\tX\tI24a\t211')
    expect(e[0].date).toBe('2026-12-28')
    const { exams: e2 } = parseSchoolExams('28.12. - 03.01.27 (Woche 53)\tFreitag (2.1.)\t08:40:00\t09:25:00\tM\tX\tI24a\t211')
    expect(e2[0].date).toBe('2027-01-02')
  })

  it('skips header and junk lines instead of failing', () => {
    const { exams: e, skipped: s } = parseSchoolExams('Woche\tTag\tVon\tBis\tFach\n' + sample.split('\n')[0] + '\nsome random text')
    expect(e).toHaveLength(1)
    expect(s).toEqual(['Woche\tTag\tVon\tBis\tFach', 'some random text'])
  })
})

describe('suggestSubject', () => {
  const subjects = [
    { id: '1', name: 'Maths' }, { id: '2', name: 'German' }, { id: '3', name: 'French' },
    { id: '4', name: 'Economics' }, { id: '5', name: 'Science' },
  ]
  it('maps school codes to the user’s subjects', () => {
    expect(suggestSubject('M', subjects)?.name).toBe('Maths')
    expect(suggestSubject('D', subjects)?.name).toBe('German')
    expect(suggestSubject('FRw', subjects)?.name).toBe('French')
    expect(suggestSubject('WR', subjects)?.name).toBe('Economics')
    expect(suggestSubject('TuU', subjects)?.name).toBe('Science')
    expect(suggestSubject('XYZ', subjects)).toBeUndefined()
  })
  it('also matches German subject names', () => {
    expect(suggestSubject('M', [{ id: '9', name: 'Mathematik' }])?.id).toBe('9')
  })
})
