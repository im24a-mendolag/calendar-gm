// Parser for the exam list copied from the school portal (tab-separated table rows), e.g.
//   31.08. - 06.09.26 (Woche 36)  Donnerstag (3.9.)  12:35:00  13:20:00  M  <teacher>  I24a  211  <note>  …  I24a (1 Lektion)

export interface PastedExam {
  /** Stable key for re-imports: date + start + subject code. */
  key: string
  date: string
  startTime: string
  endTime: string
  /** Subject code as written by the school, e.g. "M", "WR", "FRw". */
  code: string
  teachers: string
  room: string | null
  /** Free text column, e.g. "Listening" or "Examen écrit". */
  note: string | null
}

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/** "31.08. - 06.09.26" → { start, end } (the year is only written on the end date). */
function parseWeekRange(cell: string) {
  const m = /(\d{1,2})\.(\d{1,2})\.\s*-\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(cell)
  if (!m) return null
  const endYear = Number(m[5]) < 100 ? 2000 + Number(m[5]) : Number(m[5])
  const end = iso(endYear, Number(m[4]), Number(m[3]))
  // A week like 28.12. - 03.01.27 starts in the previous year.
  const startYear = Number(m[2]) > Number(m[4]) ? endYear - 1 : endYear
  return { start: iso(startYear, Number(m[2]), Number(m[1])), end }
}

/** "Donnerstag (3.9.)" → the date inside the week range. */
function parseDay(cell: string, range: { start: string; end: string }) {
  const m = /\((\d{1,2})\.(\d{1,2})\.?\)/.exec(cell)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  for (const year of [Number(range.end.slice(0, 4)), Number(range.start.slice(0, 4))]) {
    const date = iso(year, month, day)
    if (date >= range.start && date <= range.end) return date
  }
  return null
}

const timeCell = (cell: string) => {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(cell.trim())
  return m ? `${pad(Number(m[1]))}:${m[2]}` : null
}

/** Parse pasted rows. Lines that don't look like an exam row are returned in `skipped`. */
export function parseSchoolExams(text: string): { exams: PastedExam[]; skipped: string[] } {
  const exams: PastedExam[] = []
  const skipped: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue
    const cells = raw.split('\t').map((c) => c.trim())
    const rangeCell = cells.find((c) => /\d\.\s*-\s*\d/.test(c))
    const range = rangeCell ? parseWeekRange(rangeCell) : null
    const dayCell = cells.find((c) => /\(\d{1,2}\.\d{1,2}\.?\)/.test(c))
    const date = range && dayCell ? parseDay(dayCell, range) : null
    const firstTime = cells.findIndex((c) => timeCell(c))
    const startTime = firstTime >= 0 ? timeCell(cells[firstTime]) : null
    const endTime = firstTime >= 0 ? timeCell(cells[firstTime + 1] ?? '') : null
    const code = cells[firstTime + 2] ?? ''
    if (!date || !startTime || !endTime || !code || startTime >= endTime) {
      skipped.push(raw.trim())
      continue
    }
    const room = cells[firstTime + 5] || null
    const note = cells[firstTime + 6] || null
    exams.push({
      key: `school:${date}|${startTime}|${code}`,
      date,
      startTime,
      endTime,
      code,
      teachers: cells[firstTime + 3] ?? '',
      room,
      note,
    })
  }
  return { exams, skipped }
}

/**
 * Common Swiss school subject codes → names [German, English, …aliases] used to suggest a match
 * (the English name, index 1, is the default name for a newly created subject)
 * with the user's subjects. Unknown codes simply get no suggestion.
 */
export const SUBJECT_CODE_NAMES: Record<string, string[]> = {
  m: ['Mathematik', 'Maths', 'Math', 'Mathematics'],
  d: ['Deutsch', 'German'],
  e: ['Englisch', 'English'],
  f: ['Französisch', 'French', 'Franzoesisch'],
  frw: ['Französisch', 'French'],
  i: ['Italienisch', 'Italian'],
  wr: ['Wirtschaft und Recht', 'Economics and Law', 'Wirtschaft & Recht', 'Economics', 'W&R'],
  tuu: ['Technik und Umwelt', 'Technology and Environment', 'Science'],
  ge: ['Geschichte', 'History'],
  g: ['Geschichte', 'History'],
  gg: ['Geografie', 'Geographie', 'Geography'],
  geo: ['Geografie', 'Geographie', 'Geography'],
  ph: ['Physik', 'Physics'],
  p: ['Physik', 'Physics'],
  ch: ['Chemie', 'Chemistry'],
  c: ['Chemie', 'Chemistry'],
  b: ['Biologie', 'Biology'],
  bio: ['Biologie', 'Biology'],
  inf: ['Informatik', 'Informatics', 'Computer Science'],
  ik: ['Informatik', 'Informatics', 'Computer Science'],
  bg: ['Bildnerisches Gestalten', 'Art'],
  mu: ['Musik', 'Music'],
  sp: ['Sport'],
  gs: ['Gesellschaft', 'Social Studies'],
}

/** The user's subject that best matches a school code, if any. */
export function suggestSubject<T extends { id: string; name: string }>(code: string, subjects: T[]): T | undefined {
  const lower = code.toLowerCase()
  const exact = subjects.find((s) => s.name.toLowerCase() === lower)
  if (exact) return exact
  const names = (SUBJECT_CODE_NAMES[lower] ?? []).map((n) => n.toLowerCase())
  return (
    subjects.find((s) => names.includes(s.name.toLowerCase())) ??
    subjects.find((s) => names.some((n) => s.name.toLowerCase().startsWith(n) || n.startsWith(s.name.toLowerCase())))
  )
}
