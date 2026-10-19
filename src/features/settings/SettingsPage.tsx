import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toMinutes } from '../../../shared/dates'
import type { WakeTime } from '../../../shared/types'
import { Icon } from '../../components/Icon'
import { signOut, useSession } from '../../lib/auth-client'
import { WEEKDAYS, dateRange, todayIso } from '../../lib/format'
import { useHolidays, useSaveWakeTimes, useSettings, useSlots, useTerms, useUpdateSettings } from '../../lib/queries'
import { applyTheme, getTheme, type ThemeChoice } from '../../lib/theme'
import { DateRangePopover, type DateRangeItem } from '../terms/DateRangePopover'
import styles from './SettingsPage.module.css'
import { TagsSection } from './TagsSection'

type Open = { kind: 'term' | 'holiday'; anchor: HTMLElement; item?: DateRangeItem }

export function SettingsPage() {
  const settings = useSettings()
  const terms = useTerms()
  const holidays = useHolidays()
  const slots = useSlots()
  const saveWake = useSaveWakeTimes()
  const updateSettings = useUpdateSettings()
  const { data: session } = useSession()
  const navigate = useNavigate()
  const [theme, setTheme] = useState<ThemeChoice>(getTheme)
  // Local edits while typing a time; falls back to the saved values.
  const [wakeDraft, setWake] = useState<WakeTime[] | null>(null)
  const wake = wakeDraft ?? settings.data?.wakeTimes
  const [open, setOpen] = useState<Open | null>(null)

  // "first lesson 07:30" hint per weekday, from the term running today (or the next one).
  const today = todayIso()
  const currentTerm =
    terms.data?.find((t) => t.startDate <= today && today <= t.endDate) ?? terms.data?.find((t) => t.startDate > today)
  const firstLesson = (weekday: number) =>
    (slots.data ?? [])
      .filter((s) => s.termId === currentTerm?.id && s.weekday === weekday)
      .map((s) => s.startTime)
      .sort((a, b) => toMinutes(a) - toMinutes(b))[0]

  function commitWake(next: WakeTime[]) {
    setWake(next)
    saveWake.mutate(next)
  }

  const rangeItems = [
    ...(terms.data ?? []).map((t) => ({ kind: 'term' as const, item: t })),
    ...(holidays.data ?? []).map((h) => ({ kind: 'holiday' as const, item: h })),
  ].sort((a, b) => a.item.startDate.localeCompare(b.item.startDate))

  return (
    <div>
      <header className="page-header">
        <div className="titles">
          <h1 className="t-title">Settings</h1>
          <p className="t-caption c-tertiary">Changes save automatically</p>
        </div>
      </header>

      <div className={styles.columns}>
        <div className={styles.column}>
          <section className={styles.section}>
            <h2 className="t-heading">Wake-up times</h2>
            <p className="t-caption c-secondary">
              Shown as the first thing on each day in Week and Today. This is a reminder for you, not an alarm — your phone
              still does the ringing.
            </p>
            <div className="card">
              {wake?.map((w, i) => {
                const on = w.time !== null
                const first = firstLesson(w.weekday)
                return (
                  <div key={w.weekday} className="card-row">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={`${WEEKDAYS[i]} wake-up time`}
                      className="toggle"
                      onClick={() => commitWake(wake.map((x) => (x.weekday === w.weekday ? { ...x, time: on ? null : first ? '06:30' : '07:00' } : x)))}
                    />
                    <span className={`${styles.grow} ${on ? '' : 'c-tertiary'}`}>{WEEKDAYS[i]}</span>
                    {first && <span className="t-caption c-tertiary">first lesson {first}</span>}
                    {on ? (
                      <input
                        type="time"
                        className={`input input-mono ${styles.time}`}
                        value={w.time ?? ''}
                        onChange={(e) => setWake(wake.map((x) => (x.weekday === w.weekday ? { ...x, time: e.target.value || null } : x)))}
                        onBlur={() => commitWake(wake)}
                        aria-label={`${WEEKDAYS[i]} time`}
                      />
                    ) : (
                      <span className={`t-mono c-tertiary ${styles.off}`}>Off</span>
                    )}
                  </div>
                )
              })}
              <div className={`card-row ${styles.note}`}>
                <span className="t-caption c-secondary">Holidays have no wake-up time.</span>
              </div>
            </div>
            {saveWake.error && <p className="t-caption c-now">{saveWake.error.message}</p>}
          </section>

          <section className={styles.section}>
            <h2 className="t-heading">Appearance</h2>
            <div className="card">
              <div className="card-row">
                <span className={styles.grow}>Theme</span>
                <div className="segmented" role="group" aria-label="Theme">
                  {(['light', 'dark', 'system'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={theme === t}
                      onClick={() => {
                        setTheme(t)
                        applyTheme(t)
                      }}
                    >
                      {t[0].toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card-row">
                <span className={styles.grow}>Show weekends in week view</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.data?.showWeekends ?? false}
                  aria-label="Show weekends"
                  className="toggle"
                  onClick={() => updateSettings.mutate({ showWeekends: !settings.data?.showWeekends })}
                />
              </div>
            </div>
          </section>
        </div>

        <div className={styles.column}>
          <section className={styles.section}>
            <h2 className="t-heading">Terms &amp; holidays</h2>
            <p className="t-caption c-secondary">Lessons only repeat inside a term and are skipped on holidays.</p>
            <div className="card">
              {rangeItems.map(({ kind, item }) => (
                <button
                  key={item.id}
                  type="button"
                  className={`card-row ${styles.rowButton}`}
                  onClick={(e) => setOpen({ kind, anchor: e.currentTarget, item })}
                >
                  <span className={`t-label ${styles.kind} ${kind === 'term' ? styles.kindTerm : ''}`}>{kind}</span>
                  <span className={`t-body-strong ${styles.grow}`}>{item.name}</span>
                  <span className="t-mono-small c-secondary">{dateRange(item.startDate, item.endDate)}</span>
                </button>
              ))}
              <div className="card-row">
                <button type="button" className="btn btn-ghost" onClick={(e) => setOpen({ kind: 'term', anchor: e.currentTarget })}>
                  <Icon name="plus" size={14} /> Add term
                </button>
                <button type="button" className="btn btn-ghost" onClick={(e) => setOpen({ kind: 'holiday', anchor: e.currentTarget })}>
                  <Icon name="plus" size={14} /> Add holiday
                </button>
              </div>
            </div>
          </section>

          <TagsSection />

          <section className={styles.section}>
            <h2 className="t-heading">Account</h2>
            <div className="card">
              <div className="card-row">
                <span className={`c-secondary ${styles.grow}`}>Signed in as</span>
                <span className="t-mono-small">{session?.user.email}</span>
              </div>
              <div className="card-row">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => void signOut().then(() => navigate('/login', { replace: true }))}
                >
                  Sign out
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {open && <DateRangePopover kind={open.kind} anchor={open.anchor} item={open.item} onClose={() => setOpen(null)} />}
    </div>
  )
}
