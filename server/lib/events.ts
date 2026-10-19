import type { Prisma } from '../../generated/prisma/client.js'
import type { CalendarEvent } from '../../shared/types.js'
import { fromDbDate, fromDbTimeOrNull } from './datetime.js'

/** Prisma include that loads an event's tags in a stable (A–Z) order. */
export const eventInclude = {
  tags: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
} satisfies Prisma.EventInclude

type EventWithTags = Prisma.EventGetPayload<{ include: typeof eventInclude }>

export const eventDto = (e: EventWithTags): CalendarEvent => ({
  id: e.id,
  kind: e.kind,
  title: e.title,
  subjectId: e.subjectId,
  date: fromDbDate(e.date),
  startTime: fromDbTimeOrNull(e.startTime),
  endTime: fromDbTimeOrNull(e.endTime),
  allDay: e.allDay,
  location: e.location,
  topics: e.topics,
  notes: e.notes,
  reminderDays: e.reminderDays,
  tags: e.tags.map((t) => t.name),
  tagIds: e.tags.map((t) => t.id),
})
