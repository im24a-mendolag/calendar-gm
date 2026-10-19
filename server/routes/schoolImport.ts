import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../db/client.js'
import { schoolExamImportInput } from '../../shared/schemas.js'
import type { AppEnv } from '../app.js'
import { toDbDate, toDbTime } from '../lib/datetime.js'
import { readBody } from '../lib/validate.js'

/**
 * POST /api/import/exams — exams pasted from the school portal.
 * Creates the subjects the user asked for, then adds each exam or updates it if the same
 * exam (date + start + subject code) was imported before. Re-imports keep tags set in the app.
 */
export const schoolImport = new Hono<AppEnv>().post('/exams', async (c) => {
  const userId = c.get('user').id
  const input = await readBody(c, schoolExamImportInput)

  const chosen = input.subjects.map((s) => s.subjectId).filter((id): id is string => !!id)
  if (chosen.length && (await prisma.subject.count({ where: { userId, id: { in: chosen } } })) !== new Set(chosen).size) {
    throw new HTTPException(400, { message: 'Unknown subject' })
  }

  const keys = input.exams.map((e) => e.key)
  const existing = await prisma.event.findMany({
    where: { userId, source: 'school', icsUid: { in: keys } },
    select: { id: true, icsUid: true },
  })
  const idByKey = new Map(existing.map((e) => [e.icsUid!, e.id]))

  const result = await prisma.$transaction(async (tx) => {
    const subjectByCode = new Map<string, string | null>()
    let subjectsCreated = 0
    for (const s of input.subjects) {
      if (s.create) {
        const created = await tx.subject.create({ data: { userId, name: s.create.name, color: s.create.color, teacher: s.create.teacher ?? null } })
        subjectByCode.set(s.code, created.id)
        subjectsCreated++
      } else subjectByCode.set(s.code, s.subjectId ?? null)
    }

    const usedIds = [...new Set([...subjectByCode.values()].filter((id): id is string => !!id))]
    const nameById = new Map((await tx.subject.findMany({ where: { userId, id: { in: usedIds } }, select: { id: true, name: true } })).map((s) => [s.id, s.name]))

    let created = 0
    let updated = 0
    for (const e of input.exams) {
      const subjectId = subjectByCode.get(e.code) ?? null
      const title = (subjectId && nameById.get(subjectId)) || e.code
      const facts = {
        date: toDbDate(e.date),
        startTime: toDbTime(e.startTime),
        endTime: toDbTime(e.endTime),
        location: e.room ?? null,
        topics: e.note ?? null,
        subjectId,
      }
      const id = idByKey.get(e.key)
      if (id) {
        await tx.event.update({ where: { id, userId }, data: facts })
        updated++
      } else {
        await tx.event.create({
          data: { ...facts, userId, kind: 'exam', title, allDay: false, reminderDays: 3, source: 'school', icsUid: e.key },
        })
        created++
      }
    }
    return { created, updated, subjectsCreated }
  }, { timeout: 30_000 })

  return c.json(result)
})
