import { Hono } from 'hono'
import { prisma } from '../../db/client.js'
import { subjectInput } from '../../shared/schemas.js'
import type { AppEnv } from '../app.js'
import { subjectDto } from '../lib/serialize.js'
import { readBody } from '../lib/validate.js'

export const subjects = new Hono<AppEnv>()
  .get('/', async (c) => {
    const rows = await prisma.subject.findMany({ where: { userId: c.get('user').id }, orderBy: { name: 'asc' } })
    return c.json(rows.map(subjectDto))
  })
  .post('/', async (c) => {
    const data = await readBody(c, subjectInput)
    const row = await prisma.subject.create({ data: { ...data, userId: c.get('user').id } })
    return c.json(subjectDto(row), 201)
  })
  .patch('/:id', async (c) => {
    const data = await readBody(c, subjectInput.partial())
    const row = await prisma.subject.update({ where: { id: c.req.param('id'), userId: c.get('user').id }, data })
    return c.json(subjectDto(row))
  })
  .delete('/:id', async (c) => {
    // Cascades to lesson slots; events/homework keep their row with subject set to null.
    await prisma.subject.delete({ where: { id: c.req.param('id'), userId: c.get('user').id } })
    return c.body(null, 204)
  })
