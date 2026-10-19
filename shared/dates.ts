// Calendar-date math on 'YYYY-MM-DD' strings. Done in UTC so it is immune to DST and
// to the machine's timezone — these are wall-calendar dates, not instants.

const toUtc = (iso: string) => new Date(`${iso}T00:00:00Z`)
const fromUtc = (d: Date) => d.toISOString().slice(0, 10)

export function addDays(iso: string, days: number): string {
  const d = toUtc(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return fromUtc(d)
}

/** ISO weekday: 1 = Monday … 7 = Sunday */
export function isoWeekday(iso: string): number {
  const day = toUtc(iso).getUTCDay()
  return day === 0 ? 7 : day
}

/** Monday of the week containing `iso`. */
export function startOfIsoWeek(iso: string): string {
  return addDays(iso, 1 - isoWeekday(iso))
}

/** Every date from `from` to `to`, inclusive. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d)
  return days
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000)
}

/** ISO 8601 week number. */
export function isoWeekNumber(iso: string): number {
  const thursday = addDays(iso, 4 - isoWeekday(iso))
  const yearStart = `${thursday.slice(0, 4)}-01-01`
  return Math.floor(daysBetween(yearStart, thursday) / 7) + 1
}

/** 'HH:MM' → minutes since midnight */
export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
/** minutes since midnight → 'HH:MM' */
export const fromMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
