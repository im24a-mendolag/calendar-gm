export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

const parts = (iso: string) => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) - 1, d: Number(iso.slice(8, 10)) })

/** '2026-10-19' → '19 Oct' */
export const shortDate = (iso: string) => `${parts(iso).d} ${MONTHS_SHORT[parts(iso).m]}`
/** '2026-10-19' → 'October' */
export const monthName = (iso: string) => MONTHS[parts(iso).m]

/** '17 Aug – 23 Dec 2026' (year shown once, at the end) */
export function dateRange(start: string, end: string) {
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  return `${shortDate(start)}${sameYear ? '' : ' ' + start.slice(0, 4)} – ${shortDate(end)} ${end.slice(0, 4)}`
}

/** Week header: '19 – 23 October 2026', or '28 Sep – 2 Oct 2026' across months. */
export function weekTitle(start: string, end: string) {
  const s = parts(start)
  const e = parts(end)
  if (s.m === e.m) return `${s.d} – ${e.d} ${MONTHS[e.m]} ${e.y}`
  return `${s.d} ${MONTHS_SHORT[s.m]} – ${e.d} ${MONTHS_SHORT[e.m]} ${e.y}`
}

/** Today as a local 'YYYY-MM-DD' (browser timezone). */
export function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Minutes since local midnight, right now. */
export function nowMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}
