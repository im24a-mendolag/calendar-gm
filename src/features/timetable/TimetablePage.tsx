import { useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
import { fromMinutes, toMinutes } from '../../../shared/dates'
import type { LessonSlot, Subject, Term } from '../../../shared/types'
import { Block } from '../../components/Block'
import { Icon } from '../../components/Icon'
import { WEEKDAYS, dateRange, todayIso } from '../../lib/format'
import { useSettings, useSlots, useSubjects, useTerms } from '../../lib/queries'
import { DateRangePopover } from '../terms/DateRangePopover'
import { layoutColumns, type GridItem } from '../week/layout'
import { LessonPopover } from './LessonPopover'
import { SubjectPopover } from './SubjectPopover'
import styles from './TimetablePage.module.css'

type Open =
  | { kind: 'subject'; anchor: HTMLElement; subject?: Subject }
  | { kind: 'term'; anchor: HTMLElement; term?: Term }
  | { kind: 'lesson'; anchor: HTMLElement; slot: LessonSlot }
  /** new lesson: the popover anchors to the placeholder drawn in the grid */
  | { kind: 'new'; weekday: number; start: number }

/** Tall enough that a 40-minute lesson still shows subject + time. */
const PX_PER_MIN = 1.25
const DEFAULT_START = 7 * 60
const DEFAULT_END = 17 * 60
const NEW_LESSON_MIN = 45
/** Clicks in the grid snap to this many minutes. */
const CLICK_SNAP = 5

function defaultTerm(terms: Term[]) {
  const today = todayIso()
  return (
    terms.find((t) => t.startDate <= today && today <= t.endDate) ??
    terms.find((t) => t.startDate > today) ??
    terms.at(-1)
  )
}

export function TimetablePage() {
  const subjects = useSubjects()
  const terms = useTerms()
  const slots = useSlots()
  const settings = useSettings()
  const [pickedTermId, setPickedTermId] = useState<string | null>(null)
  const [open, setOpen] = useState<Open | null>(null)
  const [ghostEl, setGhostEl] = useState<HTMLElement | null>(null)
  const close = () => setOpen(null)

  const term = terms.data?.find((t) => t.id === pickedTermId) ?? defaultTerm(terms.data ?? [])
  const dayCount = settings.data?.showWeekends ? 7 : 5
  const subjectById = useMemo(() => new Map((subjects.data ?? []).map((s) => [s.id, s])), [subjects.data])
  const termSlots = useMemo(() => (slots.data ?? []).filter((s) => s.termId === term?.id), [slots.data, term?.id])

  // Lessons per weekday, laid out side by side where they overlap.
  const itemsByDay = useMemo(() => {
    const map = new Map<number, (GridItem & { slot: LessonSlot })[]>()
    for (let d = 1; d <= dayCount; d++) {
      const items = termSlots
        .filter((s) => s.weekday === d)
        .map((s) => {
          const subject = subjectById.get(s.subjectId)
          return {
            key: s.id,
            date: String(d),
            start: toMinutes(s.startTime),
            end: toMinutes(s.endTime),
            variant: 'lesson' as const,
            color: subject?.color ?? null,
            title: subject?.name ?? 'Lesson',
            meta: `${s.startTime}–${s.endTime}${s.room ? ` · ${s.room}` : ''}`,
            tags: [],
            col: 0,
            cols: 1,
            slot: s,
          }
        })
      map.set(d, layoutColumns(items) as (GridItem & { slot: LessonSlot })[])
    }
    return map
  }, [termSlots, subjectById, dayCount])

  if (!subjects.data || !terms.data || !slots.data) return null

  // Visible hours: whole hours around the earliest and latest lesson.
  const starts = termSlots.map((s) => toMinutes(s.startTime))
  const ends = termSlots.map((s) => toMinutes(s.endTime))
  const start = Math.floor(Math.min(DEFAULT_START, ...starts) / 60) * 60
  const end = Math.ceil(Math.max(DEFAULT_END, ...ends) / 60) * 60
  const y = (m: number) => (m - start) * PX_PER_MIN
  const hours = Array.from({ length: (end - start) / 60 + 1 }, (_, i) => start + i * 60)
  const lessonsPerSubject = (id: string) => termSlots.filter((s) => s.subjectId === id).length

  function addAt(e: MouseEvent<HTMLDivElement>, weekday: number) {
    if (e.target !== e.currentTarget) return
    if (!subjects.data?.length) return setOpen({ kind: 'subject', anchor: e.currentTarget })
    const top = e.currentTarget.getBoundingClientRect().top
    const minutes = Math.round((start + (e.clientY - top) / PX_PER_MIN) / CLICK_SNAP) * CLICK_SNAP
    setOpen({ kind: 'new', weekday, start: Math.min(minutes, 23 * 60 - NEW_LESSON_MIN) })
  }

  return (
    <div>
      <header className="page-header">
        <div className="titles">
          <h1 className="t-title">Timetable</h1>
          <p className="t-caption c-tertiary">
            Your weekly template · repeats every week of the term, skipping holidays · click an empty spot to add a lesson
          </p>
        </div>
        {terms.data.length > 0 && term && (
          <select className={`input ${styles.termSelect}`} value={term.id} onChange={(e) => setPickedTermId(e.target.value)} aria-label="Term">
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
              <button type="button" className={`card-row ${styles.subjectRow} ${styles.addRow}`} onClick={(e) => setOpen({ kind: 'subject', anchor: e.currentTarget })}>
                <Icon name="plus" size={14} />
                <span className="c-secondary">{subjects.data.length ? 'Add subject' : 'Add your first subject'}</span>
              </button>
            </div>
          </aside>

          <div className={styles.gridScroll}>
            <div className={`card ${styles.grid}`} style={{ '--days': dayCount } as CSSProperties}>
              <div className={styles.headRow}>
                <div className={`t-label c-tertiary ${styles.corner}`}>Time</div>
                {WEEKDAYS.slice(0, dayCount).map((d) => (
                  <div key={d} className={`t-label c-tertiary ${styles.dayHead}`}>
                    {d}
                  </div>
                ))}
              </div>

              <div className={styles.body} style={{ height: y(end) + 8 }}>
                {hours.map((h) => (
                  <div key={h} className={styles.hourLine} style={{ top: y(h) }}>
                    {h > start && <span className="t-mono-small c-tertiary">{fromMinutes(h)}</span>}
                  </div>
                ))}
                <div className={styles.dayColumns}>
                  {Array.from({ length: dayCount }, (_, i) => i + 1).map((weekday) => (
                    <div
                      key={weekday}
                      className={styles.dayColumn}
                      onClick={(e) => addAt(e, weekday)}
                      title="Click to add a lesson here"
                    >
                      {(itemsByDay.get(weekday) ?? []).map((item) => (
                        <Block
                          key={item.key}
                          variant="lesson"
                          color={item.color}
                          title={item.title}
                          meta={item.meta}
                          selected={open?.kind === 'lesson' && open.slot.id === item.slot.id}
                          onClick={(e) => setOpen({ kind: 'lesson', anchor: e.currentTarget, slot: item.slot })}
                          style={{
                            position: 'absolute',
                            top: y(item.start) + 1,
                            height: Math.max(y(item.end) - y(item.start) - 2, 22),
                            left: `calc(${(item.col / item.cols) * 100}% + 3px)`,
                            width: `calc(${100 / item.cols}% - 6px)`,
                          }}
                        />
                      ))}
                      {open?.kind === 'new' && open.weekday === weekday && (
                        <div
                          ref={setGhostEl}
                          className={styles.ghost}
                          style={{ top: y(open.start) + 1, height: NEW_LESSON_MIN * PX_PER_MIN - 2 }}
                        >
                          <span className="t-body-strong">New lesson</span>
                          <span className="t-mono-small c-secondary">
                            {fromMinutes(open.start)}–{fromMinutes(open.start + NEW_LESSON_MIN)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {open?.kind === 'subject' && (
        <SubjectPopover anchor={open.anchor} subject={open.subject} usedColors={subjects.data.map((s) => s.color)} onClose={close} />
      )}
      {open?.kind === 'term' && <DateRangePopover kind="term" anchor={open.anchor} item={open.term} onClose={close} />}
      {open?.kind === 'lesson' && term && (
        <LessonPopover
          anchor={open.anchor}
          slot={open.slot}
          weekday={open.slot.weekday}
          startTime={open.slot.startTime}
          endTime={open.slot.endTime}
          termId={term.id}
          termName={term.name}
          subjects={subjects.data}
          onClose={close}
        />
      )}
      {open?.kind === 'new' && term && ghostEl && (
        <LessonPopover
          anchor={ghostEl}
          weekday={open.weekday}
          startTime={fromMinutes(open.start)}
          endTime={fromMinutes(open.start + NEW_LESSON_MIN)}
          termId={term.id}
          termName={term.name}
          subjects={subjects.data}
          onClose={close}
        />
      )}
    </div>
  )
}
