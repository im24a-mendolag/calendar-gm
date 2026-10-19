import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { Icon, type IconName } from './Icon'
import { Popover } from './Popover'
import styles from './TabBar.module.css'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/today', label: 'Today', icon: 'today' },
  { to: '/week', label: 'Week', icon: 'calendar' },
  { to: '/exams', label: 'Exams', icon: 'exam' },
  { to: '/homework', label: 'Homework', icon: 'homework' },
]
const MORE: { to: string; label: string; icon: IconName }[] = [
  { to: '/timetable', label: 'Timetable', icon: 'timetable' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

/** Bottom navigation on phones (the Figma "Tab Bar"); hidden on wider screens by CSS. */
export function TabBar() {
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null)
  const { pathname } = useLocation()
  const moreActive = MORE.some((m) => pathname.startsWith(m.to))

  return (
    <nav className={styles.bar} aria-label="Main">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => `${styles.tab} ${isActive || (t.to === '/week' && pathname === '/month') ? styles.active : ''}`}>
          <Icon name={t.icon} size={20} />
          <span className="t-caption">{t.label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        className={`${styles.tab} ${moreActive ? styles.active : ''}`}
        aria-haspopup="menu"
        aria-expanded={!!moreAnchor}
        onClick={(e) => setMoreAnchor(moreAnchor ? null : e.currentTarget)}
      >
        <Icon name="settings" size={20} />
        <span className="t-caption">More</span>
      </button>
      {moreAnchor && (
        <Popover anchor={moreAnchor} onClose={() => setMoreAnchor(null)} label="More" width={200}>
          <div className={styles.menu} role="menu">
            {MORE.map((m) => (
              <NavLink key={m.to} to={m.to} role="menuitem" className={styles.menuItem} onClick={() => setMoreAnchor(null)}>
                <Icon name={m.icon} />
                {m.label}
              </NavLink>
            ))}
          </div>
        </Popover>
      )}
    </nav>
  )
}
