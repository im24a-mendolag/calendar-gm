import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import type {
  HolidayInput,
  PeriodsInput,
  SettingsPatch,
  SlotInput,
  SlotPatch,
  EventInput,
  SubjectInput,
  TagInput,
  TermInput,
  WakeTimesInput,
} from '../../shared/schemas'
import type { CalendarEvent, CalendarResponse, Holiday, LessonSlot, Period, Settings, Subject, Tag, Term } from '../../shared/types'
import { api } from './api'

export const keys = {
  subjects: ['subjects'] as const,
  terms: ['terms'] as const,
  holidays: ['holidays'] as const,
  periods: ['periods'] as const,
  slots: ['slots'] as const,
  settings: ['settings'] as const,
  calendar: ['calendar'] as const,
  tags: ['tags'] as const,
  events: ['events'] as const,
}

const json = (body: unknown) => ({ body: JSON.stringify(body) })

export const useSubjects = () => useQuery({ queryKey: keys.subjects, queryFn: () => api<Subject[]>('/subjects') })
export const useTerms = () => useQuery({ queryKey: keys.terms, queryFn: () => api<Term[]>('/terms') })
export const useHolidays = () => useQuery({ queryKey: keys.holidays, queryFn: () => api<Holiday[]>('/holidays') })
export const usePeriods = () => useQuery({ queryKey: keys.periods, queryFn: () => api<Period[]>('/periods') })
export const useSlots = () => useQuery({ queryKey: keys.slots, queryFn: () => api<LessonSlot[]>('/slots') })
export const useTags = () => useQuery({ queryKey: keys.tags, queryFn: () => api<Tag[]>('/tags') })
export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: () => api<Settings>('/settings') })
export const useCalendar = (from: string, to: string) =>
  useQuery({
    queryKey: [...keys.calendar, from, to],
    queryFn: () => api<CalendarResponse>(`/calendar?from=${from}&to=${to}`),
    placeholderData: (prev) => prev, // keep the old week on screen while the next one loads
  })

/** A mutation that refreshes the given queries (and the calendar, which derives from everything) on success. */
function useApiMutation<TVars, TResult = unknown>(fn: (vars: TVars) => Promise<TResult>, invalidate: QueryKey[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all([...invalidate, keys.calendar].map((queryKey) => qc.invalidateQueries({ queryKey }))),
  })
}

export const useCreateSubject = () =>
  useApiMutation((v: SubjectInput) => api<Subject>('/subjects', { method: 'POST', ...json(v) }), [keys.subjects])
export const useUpdateSubject = () =>
  useApiMutation(
    ({ id, ...v }: Partial<SubjectInput> & { id: string }) => api<Subject>(`/subjects/${id}`, { method: 'PATCH', ...json(v) }),
    [keys.subjects],
  )
export const useDeleteSubject = () =>
  useApiMutation((id: string) => api<void>(`/subjects/${id}`, { method: 'DELETE' }), [keys.subjects, keys.slots])

export const useSaveTerm = () =>
  useApiMutation(
    ({ id, ...v }: TermInput & { id?: string }) =>
      api<Term>(id ? `/terms/${id}` : '/terms', { method: id ? 'PUT' : 'POST', ...json(v) }),
    [keys.terms],
  )
export const useDeleteTerm = () =>
  useApiMutation((id: string) => api<void>(`/terms/${id}`, { method: 'DELETE' }), [keys.terms, keys.slots])

export const useSaveHoliday = () =>
  useApiMutation(
    ({ id, ...v }: HolidayInput & { id?: string }) =>
      api<Holiday>(id ? `/holidays/${id}` : '/holidays', { method: id ? 'PUT' : 'POST', ...json(v) }),
    [keys.holidays],
  )
export const useDeleteHoliday = () =>
  useApiMutation((id: string) => api<void>(`/holidays/${id}`, { method: 'DELETE' }), [keys.holidays])

export const useSavePeriods = () =>
  useApiMutation((v: PeriodsInput) => api<Period[]>('/periods', { method: 'PUT', ...json(v) }), [keys.periods])

export const useCreateSlot = () =>
  useApiMutation((v: SlotInput) => api<LessonSlot>('/slots', { method: 'POST', ...json(v) }), [keys.slots])
export const useUpdateSlot = () =>
  useApiMutation(
    ({ id, ...v }: SlotPatch & { id: string }) => api<LessonSlot>(`/slots/${id}`, { method: 'PATCH', ...json(v) }),
    [keys.slots],
  )
export const useDeleteSlot = () =>
  useApiMutation((id: string) => api<void>(`/slots/${id}`, { method: 'DELETE' }), [keys.slots])

export const useUpdateSettings = () =>
  useApiMutation((v: SettingsPatch) => api<Settings>('/settings', { method: 'PATCH', ...json(v) }), [keys.settings])
export const useSaveWakeTimes = () =>
  useApiMutation((v: WakeTimesInput) => api<Settings>('/settings/wake-times', { method: 'PUT', ...json(v) }), [keys.settings])

export const useCreateTag = () => useApiMutation((v: TagInput) => api<Tag>('/tags', { method: 'POST', ...json(v) }), [keys.tags])
export const useRenameTag = () =>
  useApiMutation(({ id, ...v }: TagInput & { id: string }) => api<Tag>(`/tags/${id}`, { method: 'PATCH', ...json(v) }), [keys.tags])
export const useDeleteTag = () => useApiMutation((id: string) => api<void>(`/tags/${id}`, { method: 'DELETE' }), [keys.tags])

export interface EventQuery {
  from?: string
  to?: string
  kinds?: readonly string[]
  order?: 'asc' | 'desc'
  limit?: number
}
export function useEvents(query: EventQuery) {
  const params = new URLSearchParams()
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)
  if (query.kinds?.length) params.set('kinds', query.kinds.join(','))
  if (query.order) params.set('order', query.order)
  if (query.limit) params.set('limit', String(query.limit))
  const qs = params.toString()
  return useQuery({ queryKey: [...keys.events, qs], queryFn: () => api<CalendarEvent[]>(`/events?${qs}`) })
}

export const useSaveEvent = () =>
  useApiMutation(
    ({ id, ...v }: EventInput & { id?: string }) =>
      api<CalendarEvent>(id ? `/events/${id}` : '/events', { method: id ? 'PUT' : 'POST', ...json(v) }),
    [keys.events, keys.tags],
  )
export const useDeleteEvent = () =>
  useApiMutation((id: string) => api<void>(`/events/${id}`, { method: 'DELETE' }), [keys.events, keys.tags])
