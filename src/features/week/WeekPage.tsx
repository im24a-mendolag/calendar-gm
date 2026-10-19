import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { addDays, eachDay, fromMinutes, isoWeekNumber, startOfIsoWeek, toMinutes } from '../../../shared/dates'
import type { CalendarEvent } from '../../../shared/types'
import { Block } from '../../components/Block'
import { Icon } from '../../components/Icon'
import { WEEKDAYS_SHORT, todayIso, weekTitle } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { useCalendar, useSettings, useSubjects } from '../../lib/queries'
import { EventPopover, type EventDraft } from '../events/EventPopover'
import { eventItem, hideReplacedLessons, layoutColumns, lessonItem, type GridItem } from './layout'
import styles from './WeekPage.module.css'

const PX_PER_MIN = 1.2
const DEFAULT_START = 7 * 60
const DEFAULT_END = 17 * 60

type Open =
  | { kind: 'edit'; event: CalendarEvent; anchor: HTMLElement }
  /** anchor = the New button; without one, the popover anchors to the dashed placeholder in the grid */
  | { kind: 'new'; draft: EventDraft; anchor?: HTMLElement }

export function WeekPage() {
  const now = useNow()
  const [weekStart, setWeekStart] = useState(() => startOfIsoWeek(todayIso()))
  const settings = useSettings()
  const subjects = useSubjects()
  const dayCount = settings.data?.showWeekends ? 7 : 5
  const days = eachDay(weekStart, addDays(weekStart, dayCount - 1))
  const calendar = useCalendar(weekStart, addDays(weekStart, 6))
  const [open, setOpen] = useState<Open | null>(null)
  const [ghostEl, setGhostEl] = useState<HTMLElement | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).matches('input, textarea, select')) return
      if (e.key === 'ArrowLeft') setWeekStart((w) => addDays(w, -7))
      if (e.key === 'ArrowRight') setWeekStart((w) => addDays(w, 7))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const subjectById = useMemo(() => new Map((subjects.data ?? []).map((s) => [s.id, s])), [subjects.data])
  const data = calendar.data

  const itemsByDay = useMemo(() => {
    const map = new Map<string, GridItem[]>()
    if (!data) return map
    const lessons = hideReplacedLessons(data.lessons, data.events).map((l) => lessonItem(l, subjectById.get(l.subjectId)))
    const events = data.events.flatMap((e) => eventItem(e, e.subjectId ? subjectById.get(e.subjectId) : undefined) ?? [])
    for (const item of [...lessons, ...events]) map.set(item.date, [...(map.get(item.date) ?? []), item])
    for (const [date, items] of map) map.set(date, layoutColumns(items))
    return map
  }, [data, subjectById])

  // Visible hours: from the earliest wake-up/item to the latest end, rounded to whole hours.
  const { start, end } = useMemo(() => {
    const visible = days.flatMap((d) => itemsByDay.get(d) ?? [])
    const wakes = (data?.days ?? []).filter((d) => days.includes(d.date) && d.wakeTime).map((d) => toMinutes(d.wakeTime!))
    const s = Math.min(DEFAULT_START, ...visible.map((i) => i.start), ...wakes.map((w) => w - 15))
    const e = Math.max(DEFAULT_END, ...visible.map((i) => i.end))
    return { start: Math.floor(s / 60) * 60, end: Math.ceil(e / 60) * 60 }
  }, [days, itemsByDay, data])

  const y = (minutes: number) => (minutes - start) * PX_PER_MIN
  const hours = Array.from({ length: (end - start) / 60 + 1 }, (_, i) => start + i * 60)
  const isEmpty = data && data.lessons.length === 0 && data.events.length === 0
  const nowInView = days.includes(now.date) && now.minutes >= start && now.minutes <= end

  const withSubject = (subjectId: string | null, text: string) => {
    const name = subjectId ? subjectById.get(subjectId)?.name : undefined
    return name ? `${name} · ${text}` : text
  }
  const dueByDay = (date: string) => [
    ...(data?.homework ?? [])
      .filter((h) => h.dueDate === date)
      .map((h) => ({ key: `h:${h.id}`, label: withSubject(h.subjectId, h.title), subjectId: h.subjectId, done: h.done })),
    ...(data?.events ?? []).filter((e) => e.date === date && (e.allDay || !e.startTime)).map((e) => ({ key: `e:${e.id}`, label: e.title, subjectId: e.subjectId, done: false })),
  ]

  return (
    <div className={styles.page}>
      <header className="page-header">
        <div className="titles">
          <h1 className="t-title">{weekTitle(days[0], days.at(-1)!)}</h1>
          <p className="t-caption c-tertiary">Week {isoWeekNumber(weekStart)}</p>
        </div>
        <button type="button" className="btn btn-secondary btn-icon" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <Icon name="chevron-left" />
        </button>
        <button type="button" className="btn btn-secondary btn-icon" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <Icon name="chevron-right" />
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setWeekStart(startOfIsoWeek(todayIso()))}>
          Today
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={(e) =>
            setOpen({ kind: 'new', anchor: e.currentTarget, draft: { date: days.includes(now.date) ? now.date : days[0], startTime: '08:00' } })
          }
        >
          New
        </button>
      </header>

      <div className={`card ${styles.grid}`} style={{ '--days': dayCount } as CSSProperties}>
        <div className={styles.headRow}>
          <div className={styles.gutter} />
          {days.map((d, i) => (
            <div key={d} className={styles.dayHead}>
              <span className={`t-label ${d === now.date ? '' : 'c-tertiary'}`}>{WEEKDAYS_SHORT[i]}</span>
              <span className={`t-body-strong ${d === now.date ? styles.todayDate : ''}`}>{Number(d.slice(8))}</span>
              {data?.days.find((x) => x.date === d)?.isHoliday && <span className="t-caption c-tertiary">Holiday</span>}
            </div>
          ))}
        </div>

        <div className={styles.dueRow}>
          <div className={`t-mono-small c-tertiary ${styles.gutter} ${styles.dueLabel}`}>Due</div>
          {days.map((d) => (
            <div key={d} className={styles.dueCell}>
              {dueByDay(d).map((item) => (
                <span key={item.key} className={`t-caption ${styles.dueChip} ${item.done ? styles.done : ''}`} data-subject={item.subjectId ? subjectById.get(item.subjectId)?.color : undefined}>
                  <span className={styles.dueBox} />
                  <span className={styles.dueText}>{item.label}</span>
                </span>
              ))}
            </div>
          ))}
        </div>

        <div className={styles.timeArea} style={{ height: y(end) + 12 }}>
          {hours.map((h) => (
            <div key={h} className={styles.hourLine} style={{ top: y(h) }}>
              {h > start && <span className="t-mono-small c-tertiary">{String(h / 60).padStart(2, '0')}:00</span>}
            </div>
          ))}

          <div className={styles.columns}>
            {days.map((d) => {
              const wake = data?.days.find((x) => x.date === d)?.wakeTime
              return (
                <div
                  key={d}
                  className={styles.dayColumn}
                  onClick={(e) => {
                    if (e.target !== e.currentTarget) return
                    const top = e.currentTarget.getBoundingClientRect().top
                    const m = Math.min(Math.round((start + (e.clientY - top) / PX_PER_MIN) / 15) * 15, 23 * 60)
                    setOpen({ kind: 'new', draft: { kind: 'appointment', date: d, startTime: fromMinutes(m), endTime: fromMinutes(Math.min(m + 60, 23 * 60 + 59)) } })
                  }}
                >
                  {wake && (
                    <div className={styles.alarm} style={{ top: y(toMinutes(wake)) - 8 }}>
                      <Icon name="bell" size={12} />
                      <span className="t-mono-small">{wake}</span>
                      <span className={styles.alarmRule} />
                    </div>
                  )}
                  {(itemsByDay.get(d) ?? []).map((item) => (
                    <Block
                      key={item.key}
                      variant={item.variant}
                      color={item.color}
                      title={item.title}
                      meta={item.meta}
                      tags={item.tags}
                      selected={open?.kind === 'edit' && open.event.id === item.eventId}
                      onClick={
                        item.eventId
                          ? (e) => {
                              const event = data?.events.find((x) => x.id === item.eventId)
                              if (event) setOpen({ kind: 'edit', event, anchor: e.currentTarget })
                            }
                          : undefined
                      }
                      style={{
                        position: 'absolute',
                        top: y(item.start) + 1,
                        height: Math.max(y(item.end) - y(item.start) - 2, 22),
                        left: `calc(${(item.col / item.cols) * 100}% + 4px)`,
                        width: `calc(${100 / item.cols}% - 8px)`,
                      }}
                    />
                  ))}
                  {open?.kind === 'new' && !open.anchor && open.draft.date === d && open.draft.startTime && (
                    <div
                      ref={setGhostEl}
                      className={styles.ghost}
                      style={{ top: y(toMinutes(open.draft.startTime)), height: 60 * PX_PER_MIN }}
                    />
                  )}
                  {nowInView && d === now.date && (
                    <div className={styles.nowLine} style={{ top: y(now.minutes) }}>
                      <span className={styles.nowDot} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {nowInView && (
            <span className={`t-mono-small c-now ${styles.nowLabel}`} style={{ top: y(now.minutes) - 7 }}>
              {String(Math.floor(now.minutes / 60)).padStart(2, '0')}:{String(now.minutes % 60).padStart(2, '0')}
            </span>
          )}

          {isEmpty && (
            <div className={styles.emptyOverlay}>
              <div className={`card ${styles.emptyCard}`}>
                <div className="empty">
                  <h2 className="t-heading">Nothing this week</h2>
                  <p className="t-body c-secondary">
                    Set up your timetable once and your lessons show up here every week.
                  </p>
                  <Link to="/timetable" className="btn btn-primary">
                    Set up timetable
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {open?.kind === 'edit' && <EventPopover anchor={open.anchor} event={open.event} onClose={() => setOpen(null)} />}
      {open?.kind === 'new' && (open.anchor ?? ghostEl) && (
        <EventPopover anchor={(open.anchor ?? ghostEl)!} draft={open.draft} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}
