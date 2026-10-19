import { Hono } from 'hono'
import { prisma } from '../../db/client.js'
import { settingsPatch, wakeTimesInput } from '../../shared/schemas.js'
import type { Settings, WakeTime } from '../../shared/types.js'
import type { AppEnv } from '../app.js'
import { fromDbTimeOrNull, toDbTimeOrNull } from '../lib/datetime.js'
import { readBody } from '../lib/validate.js'

async function loadSettings(userId: string): Promise<Settings> {
  const [settings, wake] = await Promise.all([
    prisma.userSettings.upsert({ where: { userId }, create: { userId }, update: {} }),
    prisma.wakeTime.findMany({ where: { userId } }),
  ])
  const wakeTimes: WakeTime[] = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    time: fromDbTimeOrNull(wake.find((w) => w.weekday === weekday)?.time ?? null),
  }))
  return { timezone: settings.timezone, showWeekends: settings.showWeekends, wakeTimes }
}

export const settings = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await loadSettings(c.get('user').id)))
  .patch('/', async (c) => {
    const userId = c.get('user').id
    const data = await readBody(c, settingsPatch)
    await prisma.userSettings.upsert({ where: { userId }, create: { userId, ...data }, update: data })
    return c.json(await loadSettings(userId))
  })
  .put('/wake-times', async (c) => {
    const userId = c.get('user').id
    const input = await readBody(c, wakeTimesInput)
    await prisma.$transaction(
      input.map(({ weekday, time }) =>
        prisma.wakeTime.upsert({
          where: { userId_weekday: { userId, weekday } },
          create: { userId, weekday, time: toDbTimeOrNull(time) },
          update: { time: toDbTimeOrNull(time) },
        }),
      ),
    )
    return c.json(await loadSettings(userId))
  })
