import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../db/client.js'
import { addDays } from '../../shared/dates.js'
import type { AppEnv } from '../app.js'
import { fromDbDate, fromDbTimeOrNull, toDbDate, toDbTimeOrNull } from '../lib/datetime.js'
import { eventDto, eventInclude } from '../lib/events.js'
import { buildIcs } from '../lib/icsExport.js'
import { parseIcs, type ImportedEvent } from '../lib/icsImport.js'
import { holidayDto, slotDto, subjectDto, termDto } from '../lib/serialize.js'

const MAX_BYTES = 2 * 1024 * 1024
/** Past / future range that recurring series are expanded into on import. */
const IMPORT_PAST_DAYS = 60
const IMPORT_FUTURE_DAYS = 366

/** Today's date in the user's timezone. */
const todayIn = (tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())

const toRow = (e: ImportedEvent) => ({
  kind: e.kind,
  title: e.title,
  subjectId: e.subjectId,
  date: toDbDate(e.date),
  endDate: e.endDate ? toDbDate(e.endDate) : null,
  allDay: e.allDay,
  startTime: toDbTimeOrNull(e.startTime),
  endTime: toDbTimeOrNull(e.endTime),
  location: e.location,
  notes: e.notes,
})

export const ics = new Hono<AppEnv>()
  /** GET /api/export.ics — timetable (as weekly series), lesson changes and all events. */
  .get('/export.ics', async (c) => {
    const userId = c.get('user').id
    const where = { where: { userId } }
    const [settings, subjects, terms, holidays, slots, exceptions, events] = await Promise.all([
      prisma.userSettings.findUnique(where),
      prisma.subject.findMany(where),
      prisma.term.findMany(where),
      prisma.holiday.findMany(where),
      prisma.lessonSlot.findMany(where),
      prisma.lessonException.findMany(where),
      prisma.event.findMany({ ...where, include: eventInclude, orderBy: { date: 'asc' } }),
    ])
    const body = buildIcs({
      timezone: settings?.timezone ?? 'Europe/Zurich',
      subjects: subjects.map(subjectDto),
      terms: terms.map(termDto),
      holidays: holidays.map(holidayDto),
      slots: slots.map(slotDto),
      exceptions: exceptions.map((e) => ({
        id: e.id,
        slotId: e.slotId,
        date: fromDbDate(e.date),
        kind: e.kind,
        newStartTime: fromDbTimeOrNull(e.newStartTime),
        newEndTime: fromDbTimeOrNull(e.newEndTime),
        newRoom: e.newRoom,
        note: e.note,
      })),
      events: events.map(eventDto),
    })
    return c.body(body, 200, {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'attachment; filename="calendar.ics"',
      'cache-control': 'no-store',
    })
  })
  /**
   * POST /api/import — body: the raw .ics text.
   * Events are matched on their UID, so importing the same file again updates instead of duplicating.
   */
  .post('/import', async (c) => {
    const userId = c.get('user').id
    const text = await c.req.text()
    if (!text.trim()) throw new HTTPException(400, { message: 'The file is empty' })
    if (Buffer.byteLength(text) > MAX_BYTES) throw new HTTPException(413, { message: 'File is larger than 2 MB' })
    if (!text.includes('BEGIN:VCALENDAR')) throw new HTTPException(400, { message: 'This is not an .ics calendar file' })

    const [settings, subjects] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId } }),
      prisma.subject.findMany({ where: { userId }, select: { id: true, name: true } }),
    ])
    const tz = settings?.timezone ?? 'Europe/Zurich'
    const today = todayIn(tz)
    let parsed
    try {
      parsed = parseIcs(text, { timezone: tz, from: addDays(today, -IMPORT_PAST_DAYS), to: addDays(today, IMPORT_FUTURE_DAYS), subjects })
    } catch {
      throw new HTTPException(400, { message: 'Could not read this .ics file' })
    }

    // Files exported from this app would duplicate your own timetable and events — skip them.
    const ownExport = parsed.events.filter((e) => e.icsUid.split('|')[0].endsWith('@calendar-gm')).length
    const incoming = parsed.events.filter((e) => !e.icsUid.split('|')[0].endsWith('@calendar-gm'))

    const existing = await prisma.event.findMany({
      where: { userId, icsUid: { in: incoming.map((e) => e.icsUid) } },
      select: { id: true, icsUid: true },
    })
    const idByUid = new Map(existing.map((e) => [e.icsUid!, e.id]))
    const toCreate = incoming.filter((e) => !idByUid.has(e.icsUid))
    const toUpdate = incoming.filter((e) => idByUid.has(e.icsUid))

    await prisma.$transaction([
      prisma.event.createMany({ data: toCreate.map((e) => ({ ...toRow(e), userId, source: 'ics' as const, icsUid: e.icsUid })) }),
      // Re-import keeps the kind/tags you set in the app; only the file's facts are refreshed.
      ...toUpdate.map((e) => {
        const { kind: _kind, subjectId: _subject, ...facts } = toRow(e)
        return prisma.event.update({ where: { id: idByUid.get(e.icsUid)!, userId }, data: facts })
      }),
    ])

    return c.json({ created: toCreate.length, updated: toUpdate.length, skippedOwnExport: ownExport, truncated: parsed.truncated })
  })
