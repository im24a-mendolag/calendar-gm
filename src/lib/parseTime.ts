/** Parse what people type into a time field: "840", "0840", "8:40", "8.40", "08:40" → "08:40". */
export function parseTime(input: string): string | null {
  const s = input.trim().replace(/[.,h]/g, ':')
  const m = /^(\d{1,2}):?(\d{2})$/.exec(s) ?? /^(\d{1,2})$/.exec(s)
  if (!m) return null
  const h = Number(m[1])
  const min = m[2] === undefined ? 0 : Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}
