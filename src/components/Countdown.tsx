import { daysBetween } from '../../shared/dates'
import { todayIso } from '../lib/format'
import styles from './Countdown.module.css'

/** Days from today until `date`: 'today', 'tomorrow', 'in 4 days', '2 days ago'. */
export function countdownLabel(date: string, today = todayIso()) {
  const d = daysBetween(today, date)
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  if (d === -1) return 'yesterday'
  return d > 0 ? `in ${d} days` : `${-d} days ago`
}

/** Within the event's own reminder window (default 3 days) → red "soon" style. */
export function isSoon(date: string, reminderDays: number | null, today = todayIso()) {
  const d = daysBetween(today, date)
  return d >= 0 && d <= (reminderDays ?? 3)
}

/** The Figma "Countdown" chip. `overdue`: dates in the past read "overdue" (homework). */
export function Countdown({ date, reminderDays = null, overdue = false }: { date: string; reminderDays?: number | null; overdue?: boolean }) {
  const late = overdue && date < todayIso()
  return (
    <span className={`t-mono-small ${styles.chip} ${late || isSoon(date, reminderDays) ? styles.soon : ''}`}>
      {late ? 'overdue' : countdownLabel(date)}
    </span>
  )
}
