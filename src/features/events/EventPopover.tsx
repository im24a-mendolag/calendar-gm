import { useEffect, useState } from 'react'
import {
  ASSESSED_KINDS,
  COUNTDOWN_KINDS,
  EVENT_KIND_LABELS,
  PERSONAL_KINDS,
  type EventKind,
} from '../../../shared/constants'
import { fromMinutes, toMinutes } from '../../../shared/dates'
import type { CalendarEvent } from '../../../shared/types'
import { Popover, PopoverForm } from '../../components/Popover'
import { shortDate } from '../../lib/format'
import { useDeleteEvent, useSaveEvent, useSubjects } from '../../lib/queries'
import styles from './EventPopover.module.css'
import { TagPicker } from './TagPicker'

const SCHOOL_KINDS: EventKind[] = ['exam', 'test', 'presentation', 'deadline']

/** Starting values for a new event (e.g. from a click or drag in the week grid). */
export interface EventDraft {
  kind?: EventKind
  date: string
  startTime?: string
  endTime?: string
  subjectId?: string | null
}

/** What the grid's placeholder card shows while you type. */
export interface DraftPreview {
  title: string
  date: string
  startTime: string | null
  endTime: string | null
}

export function EventPopover({
  anchor,
  event,
  draft,
  compact = false,
  onPreview,
  onClose,
}: {
  anchor: HTMLElement
  /** Existing event to edit; otherwise a new one is created from `draft`. */
  event?: CalendarEvent
  draft?: EventDraft
  /** Start with just title / type / time; "More options" reveals the rest. */
  compact?: boolean
  onPreview?: (p: DraftPreview) => void
  onClose: () => void
}) {
  const subjects = useSubjects()
  const save = useSaveEvent()
  const remove = useDeleteEvent()

  const start0 = event?.startTime ?? draft?.startTime ?? '08:00'
  const [expanded, setExpanded] = useState(!compact)
  const [kind, setKind] = useState<EventKind>(event?.kind ?? draft?.kind ?? 'exam')
  const [subjectId, setSubjectId] = useState<string>(event?.subjectId ?? draft?.subjectId ?? '')
  const [title, setTitle] = useState(event?.title ?? '')
  // Untouched titles of school events follow the chosen subject ("Maths").
  const [titleTouched, setTitleTouched] = useState(Boolean(event))
  const [date, setDate] = useState(event?.date ?? draft?.date ?? '')
  const [endDate, setEndDate] = useState(event?.endDate ?? '')
  const [allDay, setAllDay] = useState(event?.allDay ?? kind === 'deadline')
  const [startTime, setStart] = useState(start0)
  const [endTime, setEnd] = useState(event?.endTime ?? draft?.endTime ?? fromMinutes(Math.min(toMinutes(start0) + 60, 23 * 60 + 59)))
  const [location, setLocation] = useState(event?.location ?? '')
  const [topics, setTopics] = useState(event?.topics ?? '')
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [reminderDays, setReminderDays] = useState<number | null>(event?.reminderDays ?? 3)
  const [tagIds, setTagIds] = useState<string[]>(event?.tagIds ?? [])

  const school = SCHOOL_KINDS.includes(kind)
  const assessed = ASSESSED_KINDS.includes(kind)
  const multiDay = !!endDate && endDate > date
  const subjectName = subjects.data?.find((s) => s.id === subjectId)?.name ?? ''
  const shownTitle = titleTouched || !school ? title : subjectName
  const error = save.error ?? remove.error

  useEffect(() => {
    onPreview?.({
      title: shownTitle || EVENT_KIND_LABELS[kind],
      date,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
    })
  }, [onPreview, shownTitle, kind, date, allDay, startTime, endTime])

  function pickSubject(id: string) {
    setSubjectId(id)
    const subject = subjects.data?.find((s) => s.id === id)
    if (!location && subject?.defaultRoom && school) setLocation(subject.defaultRoom)
  }

  async function submit() {
    await save.mutateAsync({
      id: event?.id,
      kind,
      title: shownTitle.trim() || EVENT_KIND_LABELS[kind],
      subjectId: school ? subjectId || null : null,
      date,
      endDate: multiDay ? endDate : null,
      allDay,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime || null,
      location: location || null,
      topics: assessed ? topics || null : null,
      notes: notes || null,
      reminderDays: COUNTDOWN_KINDS.includes(kind) ? reminderDays : null,
      tagIds,
    })
    onClose()
  }

  return (
    <Popover anchor={anchor} onClose={onClose} label={event ? 'Edit event' : 'New event'} width={340}>
      <PopoverForm
        title={event ? 'Edit event' : 'New event'}
        meta={date ? shortDate(date) + (multiDay ? ` – ${shortDate(endDate)}` : '') : undefined}
        onSubmit={() => void submit().catch(() => {})}
        actions={
          <>
            {event ? (
              <button type="button" className="btn btn-danger" onClick={() => void remove.mutateAsync(event.id).then(onClose, () => {})}>
                Delete
              </button>
            ) : expanded ? (
              <span />
            ) : (
              <button type="button" className="btn btn-ghost" onClick={() => setExpanded(true)}>
                More options
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={!date || save.isPending}>
              {event ? 'Done' : 'Add'}
            </button>
          </>
        }
      >
        <label className="field">
          <span>Title</span>
          <input
            className="input"
            value={shownTitle}
            placeholder={school ? 'Defaults to the subject' : EVENT_KIND_LABELS[kind]}
            onChange={(e) => {
              setTitle(e.target.value)
              setTitleTouched(true)
            }}
            maxLength={100}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Type</span>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
              <optgroup label="School">
                {SCHOOL_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {EVENT_KIND_LABELS[k]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Personal">
                {PERSONAL_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {EVENT_KIND_LABELS[k]}
                  </option>
                ))}
              </optgroup>
              <option value="other">Other (no tag)</option>
            </select>
          </label>
          {school && (
            <label className="field">
              <span>Subject</span>
              <select className="input" value={subjectId} onChange={(e) => pickSubject(e.target.value)}>
                <option value="">None</option>
                {subjects.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="field-row">
          <label className="field">
            <span>{multiDay ? 'From' : 'Date'}</span>
            <input className="input input-mono" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="field">
            <span>Until (optional)</span>
            <input
              className="input input-mono"
              type="date"
              value={endDate}
              min={date}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="Last day (for events over several days)"
            />
          </label>
        </div>

        <div className={styles.timeRow}>
          {!allDay && (
            <>
              <label className="field">
                <span>{multiDay ? 'Starts' : 'Start'}</span>
                <input className="input input-mono" type="time" value={startTime} onChange={(e) => setStart(e.target.value)} required />
              </label>
              <label className="field">
                <span>{multiDay ? 'Ends' : 'End'}</span>
                <input className="input input-mono" type="time" value={endTime} min={multiDay ? undefined : startTime} onChange={(e) => setEnd(e.target.value)} />
              </label>
            </>
          )}
          <label className={`field ${styles.allDay}`}>
            <span>All day</span>
            <button type="button" role="switch" aria-checked={allDay} aria-label="All day" className="toggle" onClick={() => setAllDay(!allDay)} />
          </label>
        </div>

        {expanded && (
          <>
            <label className="field">
              <span>{school ? 'Room' : 'Place'}</span>
              <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
            </label>

            {assessed && (
              <label className="field">
                <span>Topics</span>
                <textarea className={`input ${styles.textarea}`} rows={2} value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="One per line, or comma-separated" />
              </label>
            )}

            <label className="field">
              <span>Notes</span>
              <textarea className={`input ${styles.textarea}`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            {COUNTDOWN_KINDS.includes(kind) && (
              <label className="field">
                <span>Highlight as "soon"</span>
                <select
                  className="input"
                  value={reminderDays ?? ''}
                  onChange={(e) => setReminderDays(e.target.value === '' ? null : Number(e.target.value))}
                >
                  {[1, 2, 3, 5, 7, 14].map((n) => (
                    <option key={n} value={n}>
                      {n} day{n === 1 ? '' : 's'} before
                    </option>
                  ))}
                </select>
              </label>
            )}

            <TagPicker value={tagIds} onChange={setTagIds} />
          </>
        )}

        {error && <p className="t-caption c-now">{error.message}</p>}
      </PopoverForm>
    </Popover>
  )
}
