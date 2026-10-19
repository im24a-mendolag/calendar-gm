import { Fragment, useMemo, useState, type CSSProperties } from 'react'
import { toMinutes } from '../../../shared/dates'
import type { LessonSlot, Period, Subject, Term } from '../../../shared/types'
import { Block } from '../../components/Block'
import { Icon } from '../../components/Icon'
import { WEEKDAYS, dateRange, todayIso } from '../../lib/format'
import { usePeriods, useSettings, useSlots, useSubjects, useTerms } from '../../lib/queries'
import { DateRangePopover } from '../terms/DateRangePopover'
import { LessonPopover, type LessonDraft } from './LessonPopover'
import { PeriodsPopover } from './PeriodsPopover'
import { SubjectPopover } from './SubjectPopover'
import styles from './TimetablePage.module.css'

type Open =
  | { kind: 'subject'; anchor: HTMLElement; subject?: Subject }
  | { kind: 'lesson'; anchor: HTMLElement; draft: LessonDraft }
  | { kind: 'periods'; anchor: HTMLElement }
  | { kind: 'term'; anchor: HTMLElement; term?: Term }

/** Breaks of at least this many minutes get their own row (e.g. lunch). */
const BREAK_ROW_MIN = 30

function defaultTerm(terms: Term[]) {
  const today = todayIso()
  return (
    terms.find((t) => t.startDate <= today && today <= t.endDate) ??
    terms.find((t) => t.startDate > today) ??
    terms.at(-1)
  )
}

/** Which periods a slot covers: first period ending after its start … last period starting before its end. */
function periodSpan(slot: LessonSlot, periods: Period[]) {
  const start = toMinutes(slot.startTime)
  const end = toMinutes(slot.endTime)
  const first = periods.find((p) => toMinutes(p.endTime) > start)
  const last = periods.findLast((p) => toMinutes(p.startTime) < end)
  return first && last && first.number <= last.number ? { from: first.number, to: last.number } : null
}

export function TimetablePage() {
  const subjects = useSubjects()
  const terms = useTerms()
  const periods = usePeriods()
  const slots = useSlots()
  const settings = useSettings()
  const [pickedTermId, setPickedTermId] = useState<string | null>(null)
  const [open, setOpen] = useState<Open | null>(null)
  const close = () => setOpen(null)

  const term = terms.data?.find((t) => t.id === pickedTermId) ?? defaultTerm(terms.data ?? [])
  const dayCount = settings.data?.showWeekends ? 7 : 5
  const subjectById = useMemo(() => new Map((subjects.data ?? []).map((s) => [s.id, s])), [subjects.data])
  const termSlots = (slots.data ?? []).filter((s) => s.termId === term?.id)

  // Grid rows: one per period, plus a "Break" row for long gaps.
  const rows = useMemo(() => {
    const out: ({ kind: 'period'; period: Period } | { kind: 'break' })[] = []
    const ps = periods.data ?? []
    ps.forEach((p, i) => {
      if (i > 0 && toMinutes(p.startTime) - toMinutes(ps[i - 1].endTime) >= BREAK_ROW_MIN) out.push({ kind: 'break' })
      out.push({ kind: 'period', period: p })
    })
    return out
  }, [periods.data])
  const gridRowOf = (periodNumber: number) =>
    rows.findIndex((r) => r.kind === 'period' && r.period.number === periodNumber) + 2

  if (!subjects.data || !terms.data || !periods.data || !slots.data) return null

  const lessonsPerSubject = (id: string) => termSlots.filter((s) => s.subjectId === id).length
  const selectedSlotId = open?.kind === 'lesson' ? open.draft.slot?.id : undefined
  const occupied = new Set<string>()
  for (const slot of termSlots) {
    const span = periodSpan(slot, periods.data)
    if (span) for (let p = span.from; p <= span.to; p++) occupied.add(`${slot.weekday}|${p}`)
  }

  function openLesson(anchor: HTMLElement, draft: LessonDraft) {
    if (!subjects.data?.length) setOpen({ kind: 'subject', anchor })
    else setOpen({ kind: 'lesson', anchor, draft })
  }

  return (
    <div>
      <header className="page-header">
        <div className="titles">
          <h1 className="t-title">Timetable</h1>
          <p className="t-caption c-tertiary">
            Your weekly template · repeats every week of the term, skipping holidays
          </p>
        </div>
        {terms.data.length > 0 && term && (
          <select
            className={`input ${styles.termSelect}`}
            value={term.id}
            onChange={(e) => setPickedTermId(e.target.value)}
            aria-label="Term"
          >
            {terms.data.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {dateRange(t.startDate, t.endDate)}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="btn btn-secondary" onClick={(e) => setOpen({ kind: 'term', anchor: e.currentTarget })}>
          New term
        </button>
      </header>

      {!term ? (
        <div className={`card ${styles.emptyCard}`}>
          <div className="empty">
            <h2 className="t-heading">Start with your school term</h2>
            <p className="t-body c-secondary">
              Lessons repeat every week between the first and last day of a term. Add the current term, then fill in your
              lessons.
            </p>
            <button type="button" className="btn btn-primary" onClick={(e) => setOpen({ kind: 'term', anchor: e.currentTarget })}>
              Add term
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.columns}>
          <aside className={styles.palette}>
            <div className={styles.paletteHead}>
              <span className="t-label c-tertiary">Subjects</span>
            </div>
            <div className="card">
              {subjects.data.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`card-row ${styles.subjectRow}`}
                  data-subject={s.color}
                  onClick={(e) => setOpen({ kind: 'subject', anchor: e.currentTarget, subject: s })}
                >
                  <span className={styles.subjectSwatch} />
                  <span className={styles.subjectText}>
                    <span className="t-body-strong">{s.name}</span>
                    {s.teacher && <span className="t-caption c-tertiary">{s.teacher}</span>}
                  </span>
                  <span className="t-mono-small c-tertiary">{lessonsPerSubject(s.id)}×</span>
                </button>
              ))}
              <button
                type="button"
                className={`card-row ${styles.subjectRow} ${styles.addRow}`}
                onClick={(e) => setOpen({ kind: 'subject', anchor: e.currentTarget })}
              >
                <Icon name="plus" size={14} />
                <span className="c-secondary">{subjects.data.length ? 'Add subject' : 'Add your first subject'}</span>
              </button>
            </div>
            <button type="button" className={`btn btn-ghost ${styles.periodsBtn}`} onClick={(e) => setOpen({ kind: 'periods', anchor: e.currentTarget })}>
              Edit period times
            </button>
          </aside>

          <div className={styles.gridScroll}>
          <div
            className={`card ${styles.grid}`}
            style={{ '--days': dayCount, gridTemplateRows: `38px ${rows.map((r) => (r.kind === 'break' ? '26px' : '50px')).join(' ')}` } as CSSProperties}
          >
            <div className={`t-label c-tertiary ${styles.corner}`}>Period</div>
            {WEEKDAYS.slice(0, dayCount).map((d) => (
              <div key={d} className={`t-label c-tertiary ${styles.dayHead}`}>
                {d}
              </div>
            ))}

            {rows.map((row, i) =>
              row.kind === 'break' ? (
                <div key={`b${i}`} className={`t-caption c-tertiary ${styles.breakRow}`} style={{ gridRow: i + 2 }}>
                  Break
                </div>
              ) : (
                <Fragment key={row.period.number}>
                  <div className={styles.periodCell} style={{ gridRow: i + 2 }}>
                    <span className="t-body-strong">{row.period.number}</span>
                    <span className={`t-mono-small c-tertiary ${styles.periodTimes}`}>
                      <span>{row.period.startTime}</span>
                      <span>{row.period.endTime}</span>
                    </span>
                  </div>
                  {Array.from({ length: dayCount }, (_, d) =>
                    occupied.has(`${d + 1}|${row.period.number}`) ? null : (
                      <button
                        key={d}
                        type="button"
                        className={styles.emptyCell}
                        style={{ gridRow: i + 2, gridColumn: d + 2 }}
                        aria-label={`Add lesson ${WEEKDAYS[d]} period ${row.period.number}`}
                        onClick={(e) =>
                          openLesson(e.currentTarget, { weekday: d + 1, fromPeriod: row.period.number, toPeriod: row.period.number })
                        }
                      >
                        <Icon name="plus" size={14} />
                        <span className="t-caption">Add lesson</span>
                      </button>
                    ),
                  )}
                </Fragment>
              ),
            )}

            {termSlots.map((slot) => {
              const span = periodSpan(slot, periods.data)
              const subject = subjectById.get(slot.subjectId)
              if (!span || !subject || slot.weekday > dayCount) return null
              return (
                <Block
                  key={slot.id}
                  variant="lesson"
                  color={subject.color}
                  title={subject.name}
                  meta={slot.room ?? undefined}
                  selected={slot.id === selectedSlotId}
                  style={{ gridColumn: slot.weekday + 1, gridRow: `${gridRowOf(span.from)} / ${gridRowOf(span.to) + 1}`, margin: 3 }}
                  onClick={(e) =>
                    setOpen({ kind: 'lesson', anchor: e.currentTarget, draft: { slot, weekday: slot.weekday, fromPeriod: span.from, toPeriod: span.to } })
                  }
                />
              )
            })}
          </div>
          </div>
        </div>
      )}

      {open?.kind === 'subject' && (
        <SubjectPopover
          anchor={open.anchor}
          subject={open.subject}
          usedColors={(subjects.data ?? []).map((s) => s.color)}
          onClose={close}
        />
      )}
      {open?.kind === 'lesson' && term && (
        <LessonPopover
          anchor={open.anchor}
          draft={open.draft}
          termId={term.id}
          termName={term.name}
          subjects={subjects.data ?? []}
          periods={periods.data ?? []}
          onClose={close}
        />
      )}
      {open?.kind === 'periods' && <PeriodsPopover anchor={open.anchor} periods={periods.data ?? []} onClose={close} />}
      {open?.kind === 'term' && <DateRangePopover kind="term" anchor={open.anchor} item={open.term} onClose={close} />}
    </div>
  )
}
