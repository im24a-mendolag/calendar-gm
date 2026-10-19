import { Hono } from 'hono'
import { prisma } from '../../db/client.js'
import { holidayInput, termInput } from '../../shared/schemas.js'
import type { AppEnv } from '../app.js'
import { toDbDate } from '../lib/datetime.js'
import { holidayDto, termDto } from '../lib/serialize.js'
import { readBody } from '../lib/validate.js'

export const terms = new Hono<AppEnv>()
  .get('/', async (c) => {
    const rows = await prisma.term.findMany({ where: { userId: c.get('user').id }, orderBy: { startDate: 'asc' } })
    return c.json(rows.map(termDto))
  })
  .post('/', async (c) => {
    const { name, startDate, endDate } = await readBody(c, termInput)
    const row = await prisma.term.create({
      data: { userId: c.get('user').id, name, startDate: toDbDate(startDate), endDate: toDbDate(endDate) },
    })
    return c.json(termDto(row), 201)
  })
  .put('/:id', async (c) => {
    const { name, startDate, endDate } = await readBody(c, termInput)
    const row = await prisma.term.update({
      where: { id: c.req.param('id'), userId: c.get('user').id },
      data: { name, startDate: toDbDate(startDate), endDate: toDbDate(endDate) },
    })
    return c.json(termDto(row))
  })
  .delete('/:id', async (c) => {
    // Cascades to the term's lesson slots.
    await prisma.term.delete({ where: { id: c.req.param('id'), userId: c.get('user').id } })
    return c.body(null, 204)
  })

export const holidays = new Hono<AppEnv>()
  .get('/', async (c) => {
    const rows = await prisma.holiday.findMany({ where: { userId: c.get('user').id }, orderBy: { startDate: 'asc' } })
    return c.json(rows.map(holidayDto))
  })
  .post('/', async (c) => {
    const { name, startDate, endDate } = await readBody(c, holidayInput)
    const row = await prisma.holiday.create({
      data: { userId: c.get('user').id, name, startDate: toDbDate(startDate), endDate: toDbDate(endDate) },
    })
    return c.json(holidayDto(row), 201)
  })
  .put('/:id', async (c) => {
    const { name, startDate, endDate } = await readBody(c, holidayInput)
    const row = await prisma.holiday.update({
      where: { id: c.req.param('id'), userId: c.get('user').id },
      data: { name, startDate: toDbDate(startDate), endDate: toDbDate(endDate) },
    })
    return c.json(holidayDto(row))
  })
  .delete('/:id', async (c) => {
    await prisma.holiday.delete({ where: { id: c.req.param('id'), userId: c.get('user').id } })
    return c.body(null, 204)
  })
