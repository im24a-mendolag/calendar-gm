import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ASSESSED_KINDS, PERSONAL_KINDS } from '../../../shared/constants'
import { addDays, eachDay, isoWeekday, startOfIsoWeek } from '../../../shared/dates'
import type { CalendarEvent } from '../../../shared/types'
import { Icon } from '../../components/Icon'
import { WEEKDAYS_SHORT, monthName, todayIso } from '../../lib/format'
import { useCalendar, useSettings, useSubjects } from '../../lib/queries'
import styles from './MonthPage.module.css'

const MAX_PER_DAY = 3

/** First day of the month containing `iso`. */
const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`
/** First day of the month `n` months after the month of `iso`. */
function shiftMonth(iso: string, n: number) {
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7)) - 1 + n
  const d = new Date(Date.UTC(y, m, 1))
  return d.toISOString().slice(0, 10)
}

export function MonthPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const linked = params.get('date')
  const [month, setMonth] = useState(() => monthStart(linked && /^\d{4}-\d{2}-\d{2}$/.test(linked) ? linked : todayIso()))
  const settings = useSettings()
  const subjects = useSubjects()
  const showWeekends = settings.data?.showWeekends ?? false
  const today = todayIso()

  // Whole weeks covering the month (Mon–Sun), max 6 rows = 42 days.
  const gridStart = startOfIsoWeek(month)
  const monthEnd = addDays(shiftMonth(month, 1), -1)
  const gridEnd = addDays(startOfIsoWeek(monthEnd), 6)
  const calendar = useCalendar(gridStart, gridEnd)
  const data = calendar.data
  const subjectById = useMemo(() => new Map((subjects.data ?? []).map((s) => [s.id, s])), [subjects.data])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).matches('input, textarea, select')) return
      if (e.key === 'ArrowLeft') setMonth((m) => shiftMonth(m, -1))
      if (e.key === 'ArrowRight') setMonth((m) => shiftMonth(m, 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const days = eachDay(gridStart, gridEnd).filter((d) => showWeekends || isoWeekday(d) <= 5)
  const columns = showWeekends ? 7 : 5

  const eventsOn = (date: string) =>
    (data?.events ?? [])
      .filter((e) => e.date <= date && (e.endDate ?? e.date) >= date)
      .sort((a, b) => Number(ASSESSED_KINDS.includes(b.kind)) - Number(ASSESSED_KINDS.includes(a.kind)) || (a.startTime ?? '').localeCompare(b.startTime ?? ''))

  const chipClass = (e: CalendarEvent) =>
    ASSESSED_KINDS.includes(e.kind) && e.subjectId ? styles.solid : PERSONAL_KINDS.includes(e.kind) || !e.subjectId ? styles.personal : styles.tint

  return (
    <div>
      <header className="page-header">
        <div className="titles">
          <h1 className="t-title">
            {monthName(month)} {month.slice(0, 4)}
          </h1>
          <p className="t-caption c-tertiary">Click a day to open its week</p>
        </div>
        <div className="segmented" role="group" aria-label="View">
          <Link to={`/week?date=${month}`} role="button" aria-pressed="false" className={styles.segLink}>
            Week
          </Link>
          <button type="button" aria-pressed="true">
            Month
          </button>
        </div>
        <button type="button" className="btn btn-secondary btn-icon" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
          <Icon name="chevron-left" />
        </button>
        <button type="button" className="btn btn-secondary btn-icon" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
          <Icon name="chevron-right" />
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setMonth(monthStart(today))}>
          Today
        </button>
      </header>

      <div className={`card ${styles.grid}`} style={{ '--cols': columns } as CSSProperties}>
        {WEEKDAYS_SHORT.slice(0, columns).map((d) => (
          <div key={d} className={`t-label c-tertiary ${styles.head}`}>
            {d}
          </div>
        ))}
        {days.map((d, i) => {
          const info = data?.days.find((x) => x.date === d)
          const evs = eventsOn(d)
          const hw = (data?.homework ?? []).filter((h) => h.dueDate === d && !h.done).length
          const outside = d.slice(0, 7) !== month.slice(0, 7)
          return (
            <button
              key={d}
              type="button"
              className={`${styles.cell} ${i % columns === 0 ? styles.firstCol : ''} ${outside ? styles.outside : ''} ${info?.isHoliday ? styles.holiday : ''}`}
              onClick={() => navigate(`/week?date=${d}`)}
              aria-label={`${d}: ${evs.length} events${hw ? `, ${hw} homework due` : ''}`}
            >
              <span className={styles.cellHead}>
                <span className={`t-body-strong ${d === today ? styles.today : ''}`}>{Number(d.slice(8))}</span>
                {info?.isHoliday && <span className="t-caption c-tertiary">Holiday</span>}
              </span>
              {evs.slice(0, MAX_PER_DAY).map((e) => (
                <span
                  key={e.id}
                  className={`t-caption ${styles.chip} ${chipClass(e)}`}
                  data-subject={e.subjectId ? subjectById.get(e.subjectId)?.color : undefined}
                >
                  {e.startTime && e.date === d && !e.allDay && <span className="t-mono-small">{e.startTime}</span>}
                  <span className={styles.chipText}>{e.title}</span>
                </span>
              ))}
              {evs.length > MAX_PER_DAY && <span className="t-caption c-tertiary">+{evs.length - MAX_PER_DAY} more</span>}
              {hw > 0 && (
                <span className={`t-caption c-secondary ${styles.hw}`}>
                  <Icon name="homework" size={12} /> {hw}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
