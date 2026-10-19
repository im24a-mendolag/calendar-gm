import type { MouseEvent } from 'react'
import { daysBetween, isoWeekday } from '../../../shared/dates'
import type { Subject } from '../../../shared/types'
import { Icon } from '../../components/Icon'
import { WEEKDAYS_SHORT, shortDate, todayIso } from '../../lib/format'
import { useUpdateHomework } from '../../lib/queries'
import styles from './Homework.module.css'

/** 'today', 'tomorrow', 'Thu' (this week), '2 Nov' (later or overdue). */
export function dueLabel(due: string, today = todayIso()) {
  const d = daysBetween(today, due)
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  if (d > 1 && d < 7) return WEEKDAYS_SHORT[isoWeekday(due) - 1]
  return shortDate(due)
}

/** One homework line — the Figma "Homework Item". The checkbox ticks it off; the rest opens the editor. */
export function HomeworkRow({
  item,
  subject,
  onOpen,
}: {
  item: { id: string; title: string; dueDate: string; done: boolean; notes?: string | null }
  subject: Subject | undefined
  onOpen?: (e: MouseEvent<HTMLButtonElement>) => void
}) {
  const update = useUpdateHomework()
  const overdue = !item.done && item.dueDate < todayIso()
  const done = update.isPending ? !item.done : item.done // show the new state immediately while saving

  return (
    <div className={`${styles.row} ${done ? styles.done : ''}`} data-subject={subject?.color}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${item.title}: mark ${done ? 'not done' : 'done'}`}
        className={styles.check}
        disabled={update.isPending}
        onClick={() => update.mutate({ id: item.id, done: !item.done })}
      >
        {done && <Icon name="check" size={12} />}
      </button>
      <span className={styles.dot} />
      <button type="button" className={styles.main} onClick={onOpen} disabled={!onOpen}>
        <span className={styles.title}>{item.title}</span>
        {item.notes && <span className={`t-caption c-tertiary ${styles.notes}`}>{item.notes}</span>}
      </button>
      {subject && <span className="t-caption c-secondary">{subject.name}</span>}
      <span className={`t-mono-small ${overdue ? 'c-now' : 'c-tertiary'} ${styles.due}`}>{dueLabel(item.dueDate)}</span>
    </div>
  )
}
