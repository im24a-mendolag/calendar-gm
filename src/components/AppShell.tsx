import { useEffect } from 'react'
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router'
import { ASSESSED_KINDS, COUNTDOWN_KINDS } from '../../shared/constants'
import { isoWeekday } from '../../shared/dates'
import { useSession } from '../lib/auth-client'
import { WEEKDAYS_SHORT, todayIso } from '../lib/format'
import { useEvents, useSubjects } from '../lib/queries'
import { Countdown } from './Countdown'
import { Icon, type IconName } from './Icon'
import styles from './AppShell.module.css'

const NAV: { to: string; label: string; icon: IconName; key: string }[] = [
  { to: '/today', label: 'Today', icon: 'today', key: 't' },
  { to: '/week', label: 'Week', icon: 'calendar', key: 'w' },
  { to: '/exams', label: 'Exams', icon: 'exam', key: 'e' },
  { to: '/homework', label: 'Homework', icon: 'homework', key: 'h' },
  { to: '/timetable', label: 'Timetable', icon: 'timetable', key: '' },
  { to: '/settings', label: 'Settings', icon: 'settings', key: ',' },
]

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
}

export function AppShell() {
  const { data, isPending } = useSession()
  const navigate = useNavigate()
  const comingUp = useEvents({ kinds: COUNTDOWN_KINDS, from: todayIso(), limit: 3 })
  const subjects = useSubjects()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      const item = NAV.find((n) => n.key && n.key === e.key.toLowerCase())
      if (item) {
        e.preventDefault()
        navigate(item.to)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  if (isPending) return null
  if (!data) return <Navigate to="/login" replace />

  const initials = data.user.name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className="t-heading">Calendar</span>
        </div>
        <nav className={styles.nav} aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <Icon name={item.icon} />
              <span className={styles.navLabel}>{item.label}</span>
              {item.key && <kbd className={`t-mono-small ${styles.kbd}`}>{item.key.toUpperCase()}</kbd>}
            </NavLink>
          ))}
        </nav>
        {comingUp.data && comingUp.data.length > 0 && (
          <section className={styles.comingUp}>
            <span className={`t-label c-tertiary ${styles.sectionLabel}`}>Coming up</span>
            {comingUp.data.map((e) => (
              <Link
                key={e.id}
                to={ASSESSED_KINDS.includes(e.kind) ? '/exams' : '/today'}
                className={styles.upcoming}
                data-subject={e.subjectId ? subjects.data?.find((s) => s.id === e.subjectId)?.color : undefined}
              >
                <span className={styles.upcomingBar} />
                <span className={styles.upcomingText}>
                  <span className="t-body-strong">{e.title}</span>
                  <span className="t-mono-small c-secondary">
                    {WEEKDAYS_SHORT[isoWeekday(e.date) - 1]} {Number(e.date.slice(8))}
                    {e.startTime ? ` · ${e.startTime}` : ''}
                  </span>
                </span>
                <Countdown date={e.date} reminderDays={e.reminderDays} />
              </Link>
            ))}
          </section>
        )}
        <div className={styles.spacer} />
        <div className={styles.user}>
          <span className={`t-label ${styles.avatar}`}>{initials}</span>
          <span className={styles.userName}>{data.user.name}</span>
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
