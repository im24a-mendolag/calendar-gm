import { useState } from 'react'
import { fromMinutes, toMinutes } from '../../../shared/dates'
import type { Period } from '../../../shared/types'
import { Popover, PopoverForm } from '../../components/Popover'
import { useSavePeriods } from '../../lib/queries'
import styles from './TimetablePage.module.css'

export function PeriodsPopover({ anchor, periods, onClose }: { anchor: HTMLElement; periods: Period[]; onClose: () => void }) {
  const save = useSavePeriods()
  const [rows, setRows] = useState(periods)

  const set = (i: number, key: 'startTime' | 'endTime', value: string) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)))

  function addPeriod() {
    const last = rows.at(-1)
    const start = last ? toMinutes(last.endTime) + 5 : 7 * 60 + 30
    setRows([...rows, { number: rows.length + 1, startTime: fromMinutes(start), endTime: fromMinutes(start + 45) }])
  }

  return (
    <Popover anchor={anchor} onClose={onClose} label="Edit periods" width={300}>
      <PopoverForm
        title="School periods"
        meta={`${rows.length} periods`}
        onSubmit={() => void save.mutateAsync(rows).then(onClose, () => {})}
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={addPeriod} disabled={rows.length >= 20}>
              Add period
            </button>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </>
        }
      >
        <p className="t-caption c-secondary">
          Used to place lessons in the grid. Changing a time here doesn't move lessons you already added.
        </p>
        <div className={styles.periodList}>
          {rows.map((r, i) => (
            <div key={r.number} className={styles.periodRow}>
              <span className="t-body-strong">{r.number}</span>
              <input className="input input-mono" type="time" value={r.startTime} onChange={(e) => set(i, 'startTime', e.target.value)} required />
              <input className="input input-mono" type="time" value={r.endTime} onChange={(e) => set(i, 'endTime', e.target.value)} required />
              {i === rows.length - 1 ? (
                <button type="button" className="btn btn-ghost btn-icon" aria-label="Remove last period" onClick={() => setRows(rows.slice(0, -1))}>
                  ×
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>
        {save.error && <p className="t-caption c-now">{save.error.message}</p>}
      </PopoverForm>
    </Popover>
  )
}
