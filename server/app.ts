import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { Prisma } from '../generated/prisma/client.js'
import { auth, type AuthSession, type AuthUser } from './auth.js'
import { calendar } from './routes/calendar.js'
import { events } from './routes/events.js'
import { homework } from './routes/homework.js'
import { ics } from './routes/ics.js'
import { lessons } from './routes/lessons.js'
import { schoolImport } from './routes/schoolImport.js'
import { settings } from './routes/settings.js'
import { subjects } from './routes/subjects.js'
import { tags } from './routes/tags.js'
import { holidays, terms } from './routes/terms.js'
import { slots } from './routes/timetable.js'

export type AppEnv = {
  Variables: { user: AuthUser; session: AuthSession }
}

export const app = new Hono<AppEnv>().basePath('/api')

app.get('/health', (c) => c.json({ ok: true }))

// Better Auth owns everything under /api/auth/* (sign-up, sign-in, session, sign-out).
app.on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))

// Every other route requires a signed-in user; handlers read it from c.get('user')
// and must scope every query to that user's id.
app.use('*', async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!result) throw new HTTPException(401, { message: 'Not signed in' })
  c.set('user', result.user)
  c.set('session', result.session)
  await next()
})

app.get('/me', (c) => {
  const user = c.get('user')
  return c.json({ id: user.id, name: user.name, email: user.email })
})

app.route('/subjects', subjects)
app.route('/terms', terms)
app.route('/holidays', holidays)
app.route('/slots', slots)
app.route('/settings', settings)
app.route('/calendar', calendar)
app.route('/tags', tags)
app.route('/events', events)
app.route('/homework', homework)
app.route('/lessons', lessons)
app.route('/import', schoolImport)
app.route('/', ics)

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2025: update/delete matched no row — either it doesn't exist or belongs to someone else.
    if (err.code === 'P2025') return c.json({ error: 'Not found' }, 404)
    if (err.code === 'P2002') return c.json({ error: 'Already exists' }, 409)
  }
  console.error(err)
  return c.json({ error: 'Internal error' }, 500)
})
