import { useMemo, useState } from 'react'
import { ASSESSED_KINDS, EVENT_KIND_LABELS } from '../../../shared/constants'
import { addDays, daysBetween, isoWeekday } from '../../../shared/dates'
import type { CalendarEvent } from '../../../shared/types'
import { Countdown, isSoon } from '../../components/Countdown'
import { WEEKDAYS_SHORT, monthName, shortDate, todayIso } from '../../lib/format'
import { useDeleteEvent, useEvents, useSubjects } from '../../lib/queries'
import { EventPopover } from '../events/EventPopover'
import styles from './ExamsPage.module.css'

type Open = { anchor: HTMLElement; event?: CalendarEvent }

const splitTopics = (t: string | null) => (t ?? '').split(/\n|,|;/).map((s) => s.trim()).filter(Boolean)

export function ExamsPage() {
  const today = todayIso()
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming')
  const upcoming = useEvents({ kinds: ASSESSED_KINDS, from: today })
  const past = useEvents({ kinds: ASSESSED_KINDS, to: addDays(today, -1), order: 'desc', limit: 100 })
  const subjects = useSubjects()
  const remove = useDeleteEvent()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [open, setOpen] = useState<Open | null>(null)
  const subjectById = useMemo(() => new Map((subjects.data ?? []).map((s) => [s.id, s])), [subjects.data])

  const list = useMemo(() => (view === 'upcoming' ? upcoming.data : past.data) ?? [], [view, upcoming.data, past.data])
  const selected = list.find((e) => e.id === selectedId) ?? list[0]

  const groups = useMemo(() => {
    const out: { key: string; label: string; events: CalendarEvent[] }[] = []
    for (const e of list) {
      const key = e.date.slice(0, 7)
      const label = `${monthName(e.date)}${e.date.slice(0, 4) !== today.slice(0, 4) ? ' ' + e.date.slice(0, 4) : ''}`
      if (out.at(-1)?.key !== key) out.push({ key, label, events: [] })
      out.at(-1)!.events.push(e)
    }
    return out
  }, [list, today])

  const subjectOf = (e: CalendarEvent) => (e.subjectId ? subjectById.get(e.subjectId) : undefined)
  const timeRange = (e: CalendarEvent) => (e.startTime ? `${e.startTime}${e.endTime ? '–' + e.endTime : ''}` : 'all day')

  return (
    <div>
      <header className="page-header">
        <div className="titles">
          <h1 className="t-title">Exams</h1>
          <p className="t-caption c-tertiary">
            {upcoming.data ? `${upcoming.data.length} upcoming` : ' '}
            {past.data?.length ? ` · ${past.data.length} past` : ''}
          </p>
        </div>
        <div className="segmented" role="group" aria-label="Show">
          <button type="button" aria-pressed={view === 'upcoming'} onClick={() => setView('upcoming')}>
            Upcoming
          </button>
          <button type="button" aria-pressed={view === 'past'} onClick={() => setView('past')}>
            Past
          </button>
        </div>
        <button type="button" className="btn btn-primary" onClick={(e) => setOpen({ anchor: e.currentTarget })}>
          New exam
        </button>
      </header>

      {list.length === 0 ? (
        <div className={`card ${styles.empty}`}>
          <div className="empty">
            <h2 className="t-heading">{view === 'upcoming' ? 'No exams coming up' : 'No past exams yet'}</h2>
            <p className="t-body c-secondary">Exams, tests and presentations you add show up here with a countdown.</p>
            {view === 'upcoming' && (
              <button type="button" className="btn btn-primary" onClick={(e) => setOpen({ anchor: e.currentTarget })}>
                Add an exam
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.columns}>
          <div className={styles.list}>
            {groups.map((g) => (
              <section key={g.key} className={styles.group}>
                <span className="t-label c-tertiary">{g.label}</span>
                <div className="card">
                  {g.events.map((e) => {
                    const s = subjectOf(e)
                    return (
                      <button
                        key={e.id}
                        type="button"
                        className={`card-row ${styles.row} ${selected?.id === e.id ? styles.selected : ''}`}
                        onClick={() => setSelectedId(e.id)}
                        data-subject={s?.color}
                      >
                        <span className={styles.date}>
                          <span className="t-heading">{Number(e.date.slice(8))}</span>
                          <span className="t-label c-tertiary">{WEEKDAYS_SHORT[isoWeekday(e.date) - 1]}</span>
                        </span>
                        <span className={styles.bar} />
                        <span className={styles.text}>
                          <span className={styles.line}>
                            <span className="t-body-strong">{e.title}</span>
                            {e.kind !== 'exam' && <span className={`t-label ${styles.kind}`}>{EVENT_KIND_LABELS[e.kind]}</span>}
                            <span className="t-mono-small c-secondary">
                              {timeRange(e)}
                              {e.location ? ` · ${e.location}` : ''}
                            </span>
                          </span>
                          {e.topics && <span className={`t-caption c-tertiary ${styles.ellipsis}`}>{splitTopics(e.topics).join(', ')}</span>}
                        </span>
                        {e.tags.length > 0 && <span className="t-caption c-tertiary">{e.tags.join(', ')}</span>}
                        <Countdown date={e.date} reminderDays={view === 'past' ? null : e.reminderDays} />
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>

          {selected && (
            <aside className={`card ${styles.detail}`} data-subject={subjectOf(selected)?.color}>
              <div className={styles.detailHead}>
                <div className={styles.line}>
                  <span className={styles.swatch} />
                  <h2 className={`t-heading ${styles.grow}`}>{selected.title}</h2>
                  <span className={`t-label ${styles.kindSolid}`}>{EVENT_KIND_LABELS[selected.kind]}</span>
                </div>
                {daysBetween(today, selected.date) >= 0 ? (
                  <div>
                    <p className={`t-title ${isSoon(selected.date, selected.reminderDays) ? 'c-now' : ''}`}>
                      {daysBetween(today, selected.date) === 0
                        ? 'Today'
                        : `${daysBetween(today, selected.date)} day${daysBetween(today, selected.date) === 1 ? '' : 's'}`}
                    </p>
                    <p className="t-caption c-secondary">
                      {daysBetween(today, selected.date) === 0 ? 'at' : 'until'} {WEEKDAYS_SHORT[isoWeekday(selected.date) - 1]}{' '}
                      {shortDate(selected.date)}
                      {selected.startTime ? `, ${selected.startTime}` : ''}
                    </p>
                  </div>
                ) : (
                  <p className="t-caption c-secondary">
                    {WEEKDAYS_SHORT[isoWeekday(selected.date) - 1]} {shortDate(selected.date)} {selected.date.slice(0, 4)}
                  </p>
                )}
              </div>
              <dl className={styles.fields}>
                <dt>Time</dt>
                <dd className="t-mono-small">{timeRange(selected)}</dd>
                {selected.location && (
                  <>
                    <dt>Room</dt>
                    <dd className="t-mono-small">{selected.location}</dd>
                  </>
                )}
                {subjectOf(selected)?.teacher && (
                  <>
                    <dt>Teacher</dt>
                    <dd>{subjectOf(selected)!.teacher}</dd>
                  </>
                )}
                {selected.tags.length > 0 && (
                  <>
                    <dt>Tags</dt>
                    <dd className={styles.tags}>
                      {selected.tags.map((t) => (
                        <span key={t} className={`t-label ${styles.kind}`}>
                          {t}
                        </span>
                      ))}
                    </dd>
                  </>
                )}
              </dl>
              {selected.topics && (
                <div className={styles.block}>
                  <span className="t-label c-tertiary">Topics</span>
                  <ul className={styles.topics}>
                    {splitTopics(selected.topics).map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selected.notes && (
                <div className={styles.block}>
                  <span className="t-label c-tertiary">Notes</span>
                  <p className="c-secondary">{selected.notes}</p>
                </div>
              )}
              <div className={styles.actions}>
                <button type="button" className="btn btn-secondary" onClick={(e) => setOpen({ anchor: e.currentTarget, event: selected })}>
                  Edit
                </button>
                <span className={styles.grow} />
                <button type="button" className="btn btn-ghost" onClick={() => remove.mutate(selected.id)}>
                  Delete
                </button>
              </div>
            </aside>
          )}
        </div>
      )}

      {open && (
        <EventPopover
          anchor={open.anchor}
          event={open.event}
          draft={open.event ? undefined : { kind: 'exam', date: addDays(today, 7), startTime: '08:20', endTime: '09:05' }}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}
