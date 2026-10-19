// Prisma maps @db.Date / @db.Time columns to JS Dates pinned to UTC
// (date → 'YYYY-MM-DDT00:00:00Z', time → '1970-01-01THH:MM:00Z').
// The API speaks plain local strings instead; these helpers convert at the boundary.

export const toDbDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`)
export const fromDbDate = (d: Date) => d.toISOString().slice(0, 10)

export const toDbTime = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`)
export const fromDbTime = (d: Date) => d.toISOString().slice(11, 16)

export const toDbTimeOrNull = (hhmm: string | null | undefined) => (hhmm ? toDbTime(hhmm) : null)
export const fromDbTimeOrNull = (d: Date | null) => (d ? fromDbTime(d) : null)
