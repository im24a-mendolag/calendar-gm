import { Link } from 'react-router'
import { ASSESSED_KINDS, COUNTDOWN_KINDS, EVENT_KIND_LABELS } from '../../shared/constants'
import { addDays, isoWeekday } from '../../shared/dates'
import type { CalendarEvent, Homework } from '../../shared/types'
import { WEEKDAYS_SHORT, todayIso } from '../lib/format'
import { useEvents, useHomework, useSubjects } from '../lib/queries'
import styles from './ComingUp.module.css'
import { Countdown } from './Countdown'

const MAX_ITEMS = 5
const DAYS_AHEAD = 14

type Item = { kind: 'event'; date: string; event: CalendarEvent } | { kind: 'homework'; date: string; homework: Homework }

/**
 * Sidebar "Coming up": exams/appointments and open homework in one list by date —
 * overdue homework first, then the next 14 days. Every row: bar, title, day (· time); the kind
 * is in the hover text. The bar mirrors the calendar blocks: solid subject colour for
 * exams/tests/presentations, dashed subject colour for homework, ink for personal events.
 */
export function ComingUp() {
  const today = todayIso()
  const events = useEvents({ kinds: COUNTDOWN_KINDS, from: today, limit: MAX_ITEMS })
  const homework = useHomework('open')
  const subjects = useSubjects()
  const subjectOf = (id: string | null) => (id ? subjects.data?.find((s) => s.id === id) : undefined)

  const horizon = addDays(today, DAYS_AHEAD)
  const items: Item[] = [
    ...(events.data ?? []).filter((e) => e.date <= horizon).map((event) => ({ kind: 'event' as const, date: event.date, event })),
    ...(homework.data ?? []).filter((h) => h.dueDate <= horizon).map((h) => ({ kind: 'homework' as const, date: h.dueDate, homework: h })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === 'event' ? -1 : 1))
    .slice(0, MAX_ITEMS)

  if (items.length === 0) return null

  return (
    <section className={styles.comingUp}>
      <span className={`t-label c-tertiary ${styles.label}`}>Coming up</span>
      {items.map((item) => {
        const day = `${WEEKDAYS_SHORT[isoWeekday(item.date) - 1]} ${Number(item.date.slice(8))}`
        if (item.kind === 'homework') {
          const h = item.homework
          return (
            <Link
              key={`h:${h.id}`}
              to="/homework"
              className={styles.row}
              data-subject={subjectOf(h.subjectId)?.color}
              title={`${h.title}\nHomework · ${day}`}
            >
              <span className={`${styles.bar} ${styles.barDashed}`} />
              <span className={styles.text}>
                <span className="t-body-strong">{h.title}</span>
                <span className="t-mono-small c-secondary">{day}</span>
              </span>
              <Countdown date={h.dueDate} reminderDays={1} overdue />
            </Link>
          )
        }
        const e = item.event
        const assessed = ASSESSED_KINDS.includes(e.kind)
        const when = `${day}${e.startTime ? ` · ${e.startTime}` : ''}`
        return (
          <Link
            key={e.id}
            to={assessed ? '/exams' : '/today'}
            className={styles.row}
            data-subject={assessed ? subjectOf(e.subjectId)?.color : undefined}
            title={`${e.title}\n${EVENT_KIND_LABELS[e.kind]} · ${when}`}
          >
            <span className={styles.bar} />
            <span className={styles.text}>
              <span className="t-body-strong">{e.title}</span>
              <span className="t-mono-small c-secondary">{when}</span>
            </span>
            <Countdown date={e.date} reminderDays={e.reminderDays} />
          </Link>
        )
      })}
    </section>
  )
}
