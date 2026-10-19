import { useMemo, useState, type MouseEvent } from 'react'
import { Link } from 'react-router'
import { COUNTDOWN_KINDS, EVENT_KIND_LABELS } from '../../../shared/constants'
import { addDays, isoWeekNumber, isoWeekday, toMinutes } from '../../../shared/dates'
import type { CalendarEvent, Subject } from '../../../shared/types'
import { Countdown } from '../../components/Countdown'
import { Icon } from '../../components/Icon'
import { WEEKDAYS, WEEKDAYS_SHORT, monthName, shortDate } from '../../lib/format'
import { useCalendar, useSubjects } from '../../lib/queries'
import { useNow } from '../../lib/useNow'
import { EventPopover } from '../events/EventPopover'
import { hideReplacedLessons } from '../week/layout'
import styles from './TodayPage.module.css'

const BREAK_MIN = 30
const COMING_UP_KINDS = [...COUNTDOWN_KINDS, 'deadline'] as const

interface Entry {
  key: string
  start: number
  end: number
  startTime: string
  endTime: string
  title: string
  detail: string | null
  color: Subject['color'] | null
  cancelled: boolean
  tag: string | null
  event?: CalendarEvent
}

const STATE_CLASS = { now: styles.isNow, done: styles.isDone, cancelled: styles.isCancelled, later: '' }

const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export function TodayPage() {
  const now = useNow()
  const today = now.date
  const calendar = useCalendar(today, addDays(today, 13))
  const subjects = useSubjects()
  const [editing, setEditing] = useState<{ event: CalendarEvent; anchor: HTMLElement } | null>(null)
  const subjectById = useMemo(() => new Map((subjects.data ?? []).map((s) => [s.id, s])), [subjects.data])
  const data = calendar.data

  const entries = useMemo<Entry[]>(() => {
    if (!data) return []
    const lessons = hideReplacedLessons(
      data.lessons.filter((l) => l.date === today),
      data.events,
    ).map((l): Entry => {
      const s = subjectById.get(l.subjectId)
      return {
        key: `l:${l.slotId}`,
        start: toMinutes(l.startTime),
        end: toMinutes(l.endTime),
        startTime: l.startTime,
        endTime: l.endTime,
        title: s?.name ?? 'Lesson',
        detail: [l.room, s?.teacher].filter(Boolean).join(' · ') || null,
        color: s?.color ?? null,
        cancelled: l.status === 'cancelled',
        tag: l.status === 'changed' ? 'Changed' : l.status === 'cancelled' ? 'Cancelled' : null,
      }
    })
    const events = data.events
      .filter((e) => e.date === today && !e.allDay && e.startTime)
      .map((e): Entry => {
        const start = toMinutes(e.startTime!)
        return {
          key: `e:${e.id}`,
          start,
          end: e.endTime ? toMinutes(e.endTime) : start + 30,
          startTime: e.startTime!,
          endTime: e.endTime ?? fmt(start + 30),
          title: e.title,
          detail: e.location,
          color: e.subjectId ? (subjectById.get(e.subjectId)?.color ?? null) : null,
          cancelled: false,
          tag: e.kind === 'other' ? null : EVENT_KIND_LABELS[e.kind],
          event: e,
        }
      })
    return [...lessons, ...events].sort((a, b) => a.start - b.start)
  }, [data, today, subjectById])

  if (!data || !subjects.data) return null

  const active = entries.filter((e) => !e.cancelled)
  const current = active.find((e) => e.start <= now.minutes && now.minutes < e.end)
  const next = active.find((e) => e.start > now.minutes)
  const day = data.days.find((d) => d.date === today)
  const firstLesson = active[0]
  const allDayToday = data.events.filter((e) => e.date === today && (e.allDay || !e.startTime))

  const comingUp = data.events
    .filter((e) => (COMING_UP_KINDS as readonly string[]).includes(e.kind) && e.date >= today)
    .filter((e) => !(e.date === today && e.endTime && toMinutes(e.endTime) <= now.minutes))
    .slice(0, 8)
  const homework = data.homework.filter((h) => !h.done && h.dueDate <= addDays(today, 6)).slice(0, 8)

  const subtitleParts = [`Week ${isoWeekNumber(today)}`]
  if (day?.isHoliday) subtitleParts.push('Holiday')
  else subtitleParts.push(active.length ? `${active.filter((e) => !e.event).length} lessons today` : 'Nothing scheduled')

  // Schedule rows with "Break" rows for gaps of 30+ minutes.
  const rows: ({ kind: 'entry'; entry: Entry } | { kind: 'break'; start: number; end: number })[] = []
  entries.forEach((e, i) => {
    const prevEnd = Math.max(...entries.slice(0, i).map((p) => p.end), -1)
    if (i > 0 && e.start - prevEnd >= BREAK_MIN) rows.push({ kind: 'break', start: prevEnd, end: e.start })
    rows.push({ kind: 'entry', entry: e })
  })

  const openEvent = (event: CalendarEvent | undefined, anchor: HTMLElement) => event && setEditing({ event, anchor })

  return (
    <div>
      <header className="page-header">
        <div className="titles">
          <h1 className="t-title">
            {WEEKDAYS[isoWeekday(today) - 1]}, {Number(today.slice(8))} {monthName(today)}
          </h1>
          <p className="t-caption c-tertiary">{subtitleParts.join(' · ')}</p>
        </div>
      </header>

      <div className={styles.columns}>
        <div className={styles.left}>
          {day?.wakeTime && (
            <div className={`card ${styles.alarm}`}>
              <Icon name="bell" />
              <span className="t-mono">{day.wakeTime}</span>
              <span className={`c-secondary ${styles.grow}`}>
                Alarm{firstLesson ? ` · first ${firstLesson.event ? 'up' : 'lesson'} ${firstLesson.startTime} ${firstLesson.title}` : ''}
                {firstLesson?.detail && !firstLesson.event ? ` in ${firstLesson.detail.split(' · ')[0]}` : ''}
              </span>
              <Link to="/settings" className="t-caption c-tertiary">
                Edit
              </Link>
            </div>
          )}

          <div className={`card ${styles.nowCard}`}>
            {current ? (
              <>
                <div className={styles.now} data-subject={current.color ?? undefined}>
                  <span className={styles.bar} />
                  <div className={styles.grow}>
                    <div className={styles.nowTop}>
                      <span className={`t-label ${styles.nowTag}`}>Now</span>
                      <span className="t-mono-small c-secondary">
                        {current.startTime}–{current.endTime}
                      </span>
                    </div>
                    <h2 className="t-heading">{current.title}</h2>
                    {current.detail && <p className="t-body c-secondary">{current.detail}</p>}
                  </div>
                  <div className={styles.remaining}>
                    <span className="t-heading">{current.end - now.minutes} min</span>
                    <span className="t-caption c-tertiary">left</span>
                  </div>
                </div>
                <div className={styles.progress} data-subject={current.color ?? undefined}>
                  <span style={{ width: `${((now.minutes - current.start) / (current.end - current.start)) * 100}%` }} />
                </div>
              </>
            ) : (
              <div className={styles.now}>
                <div className={styles.grow}>
                  <h2 className="t-heading">{next ? 'Free right now' : active.length ? 'Done for today' : 'Nothing scheduled today'}</h2>
                </div>
              </div>
            )}
            {next && (
              <div className={styles.next}>
                <span className="t-label c-tertiary">Next</span>
                <span className={styles.dot} data-subject={next.color ?? undefined} />
                <span className={`t-body-strong ${styles.grow}`}>
                  {next.title} · {next.startTime}
                  {next.detail ? ` · ${next.detail.split(' · ')[0]}` : ''}
                </span>
                <span className="t-mono-small c-secondary">in {next.start - now.minutes} min</span>
              </div>
            )}
          </div>

          {(entries.length > 0 || allDayToday.length > 0) && (
            <div className="card">
              <div className={`card-row ${styles.scheduleHead}`}>
                <span className={`t-label c-tertiary ${styles.grow}`}>Schedule</span>
                {entries.length > 0 && (
                  <span className="t-mono-small c-tertiary">
                    {entries[0].startTime}–{fmt(Math.max(...entries.map((e) => e.end)))}
                  </span>
                )}
              </div>
              {allDayToday.map((e) => (
                <button key={e.id} type="button" className={`card-row ${styles.row}`} onClick={(ev) => openEvent(e, ev.currentTarget)}>
                  <span className={`t-mono-small c-tertiary ${styles.times}`}>all day</span>
                  <span className={styles.rowBar} data-subject={e.subjectId ? subjectById.get(e.subjectId)?.color : undefined} />
                  <span className={`t-body-strong ${styles.grow}`}>{e.title}</span>
                  {e.kind !== 'other' && <span className={`t-label ${styles.kind}`}>{EVENT_KIND_LABELS[e.kind]}</span>}
                </button>
              ))}
              {rows.map((r, i) => {
                if (r.kind === 'break')
                  return (
                    <div key={`b${i}`} className={`card-row ${styles.row}`}>
                      <span className={`t-mono-small c-tertiary ${styles.times}`}>
                        <span>{fmt(r.start)}</span>
                        <span>{fmt(r.end)}</span>
                      </span>
                      <span className={`${styles.rowBar} ${styles.faded}`} />
                      <span className="c-tertiary">Break</span>
                    </div>
                  )
                const e = r.entry
                const state = e.cancelled ? 'cancelled' : e === current ? 'now' : e.end <= now.minutes ? 'done' : 'later'
                const Row = e.event ? 'button' : 'div'
                return (
                  <Row
                    key={e.key}
                    {...(e.event ? { type: 'button' as const, onClick: (ev: MouseEvent<HTMLElement>) => openEvent(e.event, ev.currentTarget) } : {})}
                    className={`card-row ${styles.row} ${STATE_CLASS[state]}`}
                  >
                    <span className={`t-mono-small ${styles.times}`}>
                      <span>{e.startTime}</span>
                      <span className="c-tertiary">{e.endTime}</span>
                    </span>
                    <span className={styles.rowBar} data-subject={e.color ?? undefined} />
                    <span className={styles.rowText}>
                      <span className={`t-body-strong ${styles.rowTitle}`}>{e.title}</span>
                      {e.detail && <span className="t-caption c-tertiary">{e.detail}</span>}
                    </span>
                    {e.tag && <span className={`t-label ${styles.kind}`}>{e.tag}</span>}
                    {state === 'now' && <span className={`t-label ${styles.nowTag}`}>Now</span>}
                    {state === 'done' && <span className="t-caption c-tertiary">Done</span>}
                  </Row>
                )
              })}
            </div>
          )}
        </div>

        <aside className={styles.right}>
          <section>
            <div className={styles.sectionHead}>
              <span className={`t-label c-tertiary ${styles.grow}`}>Coming up · next 14 days</span>
              <Link to="/exams" className="t-caption c-secondary">
                All exams
              </Link>
            </div>
            <div className="card">
              {comingUp.length === 0 && <div className="card-row t-caption c-tertiary">Nothing in the next two weeks.</div>}
              {comingUp.map((e) => (
                <button key={e.id} type="button" className={`card-row ${styles.upcoming}`} onClick={(ev) => openEvent(e, ev.currentTarget)}>
                  <span
                    className={`${styles.swatch} ${e.subjectId ? '' : styles.swatchInk}`}
                    data-subject={e.subjectId ? subjectById.get(e.subjectId)?.color : undefined}
                  />
                  <span className={styles.rowText}>
                    <span className={styles.upcomingTitle}>
                      <span className="t-body-strong">{e.title}</span>
                      {e.kind !== 'other' && (
                        <span className={`t-label ${styles.kind}`}>{EVENT_KIND_LABELS[e.kind]}</span>
                      )}
                    </span>
                    <span className="t-mono-small c-secondary">
                      {WEEKDAYS_SHORT[isoWeekday(e.date) - 1]} {shortDate(e.date)}
                      {e.startTime ? ` · ${e.startTime}` : ''}
                      {e.location ? ` · ${e.location}` : ''}
                    </span>
                    {e.topics && <span className="t-caption c-tertiary">{e.topics}</span>}
                  </span>
                  <Countdown date={e.date} reminderDays={e.reminderDays} />
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className={styles.sectionHead}>
              <span className={`t-label c-tertiary ${styles.grow}`}>Homework due</span>
              <Link to="/homework" className="t-caption c-secondary">
                All homework
              </Link>
            </div>
            <div className="card">
              {homework.length === 0 && <div className="card-row t-caption c-tertiary">Nothing due this week.</div>}
              {homework.map((h) => {
                const s = h.subjectId ? subjectById.get(h.subjectId) : undefined
                return (
                  <div key={h.id} className="card-row">
                    <span className={styles.dot} data-subject={s?.color} />
                    <span className={styles.grow}>{h.title}</span>
                    {s && <span className="t-caption c-secondary">{s.name}</span>}
                    <span className="t-mono-small c-tertiary">
                      {h.dueDate === today ? 'today' : WEEKDAYS_SHORT[isoWeekday(h.dueDate) - 1]}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        </aside>
      </div>

      {editing && <EventPopover anchor={editing.anchor} event={editing.event} onClose={() => setEditing(null)} />}
    </div>
  )
}
