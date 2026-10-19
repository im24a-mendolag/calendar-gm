import { useMemo, useState } from 'react'
import { SUBJECT_COLORS, type SubjectColor } from '../../../shared/constants'
import { isoWeekday } from '../../../shared/dates'
import { SUBJECT_CODE_NAMES, parseSchoolExams, suggestSubject } from '../../../shared/schoolExams'
import { Modal } from '../../components/Modal'
import { WEEKDAYS_SHORT, shortDate } from '../../lib/format'
import { useImportSchoolExams, useSubjects } from '../../lib/queries'
import styles from './ImportExamsDialog.module.css'

/** What to do with one school subject code. */
type Choice = { kind: 'existing'; subjectId: string } | { kind: 'new'; name: string } | { kind: 'none' }

const MEMORY_KEY = 'schoolSubjectCodes'
/** Remembered code → subject id from earlier imports (per browser). */
function loadMemory(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(MEMORY_KEY) ?? '{}')
  } catch {
    return {}
  }
}
function saveMemory(map: Record<string, string>) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(map))
  } catch {
    // storage unavailable — matching just won't be remembered
  }
}

/** Readable default name for a new subject: the English name if we know the code, else the code. */
const defaultName = (code: string) => SUBJECT_CODE_NAMES[code.toLowerCase()]?.[1] ?? code

export function ImportExamsDialog({ onClose }: { onClose: () => void }) {
  const subjects = useSubjects()
  const importExams = useImportSchoolExams()
  const [text, setText] = useState('')
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [showSkipped, setShowSkipped] = useState(false)

  const parsed = useMemo(() => parseSchoolExams(text), [text])
  const codes = useMemo(() => [...new Set(parsed.exams.map((e) => e.code))], [parsed.exams])

  // Default per code: remembered → suggested by name → new subject.
  const [memory] = useState(loadMemory)
  const choiceFor = (code: string): Choice => {
    if (choices[code]) return choices[code]
    const list = subjects.data ?? []
    const remembered = list.find((s) => s.id === memory[code])
    const suggested = remembered ?? suggestSubject(code, list)
    return suggested ? { kind: 'existing', subjectId: suggested.id } : { kind: 'new', name: defaultName(code) }
  }
  const setChoice = (code: string, c: Choice) => setChoices((prev) => ({ ...prev, [code]: c }))

  const subjectLabel = (code: string) => {
    const c = choiceFor(code)
    if (c.kind === 'existing') return subjects.data?.find((s) => s.id === c.subjectId)?.name ?? code
    if (c.kind === 'new') return `${c.name} (new)`
    return code
  }

  async function submit() {
    // New subjects get colours nobody uses yet, in palette order.
    const used = new Set<SubjectColor>((subjects.data ?? []).map((s) => s.color))
    const nextColor = () => {
      const c = SUBJECT_COLORS.find((x) => !used.has(x)) ?? SUBJECT_COLORS[used.size % SUBJECT_COLORS.length]
      used.add(c)
      return c
    }
    const subjectChoices = codes.map((code) => {
      const c = choiceFor(code)
      const teacher = parsed.exams.find((e) => e.code === code)?.teachers.split(',')[0]?.trim() || null
      if (c.kind === 'existing') return { code, subjectId: c.subjectId }
      if (c.kind === 'new') return { code, create: { name: c.name.trim() || code, color: nextColor(), teacher } }
      return { code, subjectId: null }
    })
    const result = await importExams.mutateAsync({
      subjects: subjectChoices,
      exams: parsed.exams.map((e) => ({ key: e.key, code: e.code, date: e.date, startTime: e.startTime, endTime: e.endTime, room: e.room, note: e.note })),
    })
    const remember = { ...memory }
    for (const s of subjectChoices) if ('subjectId' in s && s.subjectId) remember[s.code] = s.subjectId
    saveMemory(remember)
    return result
  }

  const done = importExams.data
  const count = parsed.exams.length

  return (
    <Modal
      title="Import exams"
      onClose={onClose}
      footer={
        done ? (
          <>
            <span className="t-caption c-secondary" role="status">
              {done.created} added, {done.updated} updated{done.subjectsCreated ? ` · ${done.subjectsCreated} new subjects` : ''}
            </span>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Close
            </button>
          </>
        ) : (
          <>
            <span className="t-caption c-tertiary">
              {count ? `${count} exam${count === 1 ? '' : 's'} found` : 'Nothing recognised yet'}
              {parsed.skipped.length > 0 && (
                <>
                  {' · '}
                  <button type="button" className={styles.linkButton} onClick={() => setShowSkipped(!showSkipped)}>
                    {parsed.skipped.length} line{parsed.skipped.length === 1 ? '' : 's'} skipped
                  </button>
                </>
              )}
            </span>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={!count || importExams.isPending} onClick={() => void submit().catch(() => {})}>
              {importExams.isPending ? 'Importing…' : `Import ${count || ''} exam${count === 1 ? '' : 's'}`}
            </button>
          </>
        )
      }
    >
      <label className="field">
        <span>Paste the exam rows from your school portal (select the table, Ctrl+C, then Ctrl+V here)</span>
        <textarea
          className={`input input-mono ${styles.paste}`}
          rows={count ? 4 : 10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'31.08. - 06.09.26 (Woche 36)\tDonnerstag (3.9.)\t12:35:00\t13:20:00\tM\t…'}
          autoFocus
          spellCheck={false}
        />
      </label>

      {showSkipped && parsed.skipped.length > 0 && (
        <pre className={`t-mono-small c-tertiary ${styles.skipped}`}>{parsed.skipped.join('\n')}</pre>
      )}

      {count > 0 && (
        <>
          <section className={styles.section}>
            <h3 className="t-label c-tertiary">Subjects</h3>
            <div className="card">
              {codes.map((code) => {
                const c = choiceFor(code)
                const teachers = parsed.exams.find((e) => e.code === code)?.teachers
                const value = c.kind === 'existing' ? c.subjectId : c.kind
                return (
                  <div key={code} className={`card-row ${styles.codeRow}`}>
                    <span className={`t-mono ${styles.code}`}>{code}</span>
                    <span className={`t-caption c-tertiary ${styles.teacher}`}>{teachers}</span>
                    <select
                      className="input"
                      aria-label={`Subject for ${code}`}
                      value={value}
                      onChange={(e) =>
                        setChoice(
                          code,
                          e.target.value === 'new'
                            ? { kind: 'new', name: defaultName(code) }
                            : e.target.value === 'none'
                              ? { kind: 'none' }
                              : { kind: 'existing', subjectId: e.target.value },
                        )
                      }
                    >
                      {subjects.data?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                      <option value="new">New subject…</option>
                      <option value="none">No subject</option>
                    </select>
                    {c.kind === 'new' && (
                      <input
                        className="input"
                        aria-label={`Name for new subject ${code}`}
                        value={c.name}
                        maxLength={60}
                        onChange={(e) => setChoice(code, { kind: 'new', name: e.target.value })}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className={styles.section}>
            <h3 className="t-label c-tertiary">Exams</h3>
            <div className={`card ${styles.preview}`}>
              {parsed.exams.map((e) => (
                <div key={e.key} className={`card-row ${styles.examRow}`}>
                  <span className="t-mono-small">
                    {WEEKDAYS_SHORT[isoWeekday(e.date) - 1]} {shortDate(e.date)} {e.date.slice(0, 4)}
                  </span>
                  <span className="t-mono-small c-secondary">
                    {e.startTime}–{e.endTime}
                  </span>
                  <span className={`t-body-strong ${styles.examSubject}`}>{subjectLabel(e.code)}</span>
                  <span className="t-mono-small c-tertiary">{e.room}</span>
                  <span className="t-caption c-tertiary">{e.note}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {importExams.error && <p className="t-caption c-now">{importExams.error.message}</p>}
    </Modal>
  )
}
