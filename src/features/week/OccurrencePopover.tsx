import { useState } from 'react'
import { Link } from 'react-router'
import { isoWeekday } from '../../../shared/dates'
import type { LessonOccurrence } from '../../../shared/occurrences'
import type { Subject } from '../../../shared/types'
import { Popover, PopoverForm } from '../../components/Popover'
import { WEEKDAYS_SHORT, shortDate } from '../../lib/format'
import { useRestoreLesson, useSaveLessonException } from '../../lib/queries'

type Mode = 'usual' | 'changed' | 'cancelled'

/** Cancel or change a single dated lesson, without touching the weekly timetable. */
export function OccurrencePopover({
  anchor,
  lesson,
  subject,
  onClose,
}: {
  anchor: HTMLElement
  lesson: LessonOccurrence
  subject: Subject | undefined
  onClose: () => void
}) {
  const save = useSaveLessonException()
  const restore = useRestoreLesson()
  const initial: Mode = lesson.status === 'scheduled' ? 'usual' : lesson.status
  const [mode, setMode] = useState<Mode>(initial)
  const [start, setStart] = useState(lesson.startTime)
  const [end, setEnd] = useState(lesson.endTime)
  const [room, setRoom] = useState(lesson.room ?? '')
  const [note, setNote] = useState(lesson.note ?? '')
  const error = save.error ?? restore.error
  const key = { slotId: lesson.slotId, date: lesson.date }

  async function submit() {
    if (mode === 'usual') {
      if (initial !== 'usual') await restore.mutateAsync(key)
    } else if (mode === 'cancelled') {
      await save.mutateAsync({ ...key, kind: 'cancelled', note: note || null })
    } else {
      await save.mutateAsync({ ...key, kind: 'changed', newStartTime: start, newEndTime: end, newRoom: room || null, note: note || null })
    }
    onClose()
  }

  return (
    <Popover anchor={anchor} onClose={onClose} label="This lesson" width={300}>
      <PopoverForm
        title={subject?.name ?? 'Lesson'}
        meta={`${WEEKDAYS_SHORT[isoWeekday(lesson.date) - 1]} ${shortDate(lesson.date)}`}
        onSubmit={() => void submit().catch(() => {})}
        actions={
          <>
            <Link to="/timetable" className="btn btn-ghost">
              Edit weekly lesson
            </Link>
            <button type="submit" className="btn btn-primary" disabled={save.isPending || restore.isPending}>
              Done
            </button>
          </>
        }
      >
        <div className="segmented" role="group" aria-label="This lesson is">
          {(['usual', 'changed', 'cancelled'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m === 'usual' ? 'As usual' : m === 'changed' ? 'Changed' : 'Cancelled'}
            </button>
          ))}
        </div>

        {mode === 'usual' && (
          <p className="t-caption c-secondary">
            {lesson.startTime}–{lesson.endTime}
            {lesson.room ? ` · ${lesson.room}` : ''} · every week
          </p>
        )}

        {mode === 'changed' && (
          <>
            <div className="field-row">
              <label className="field">
                <span>Start</span>
                <input className="input input-mono" type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
              </label>
              <label className="field">
                <span>End</span>
                <input className="input input-mono" type="time" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
              </label>
            </div>
            <label className="field">
              <span>Room</span>
              <input className="input input-mono" value={room} onChange={(e) => setRoom(e.target.value)} />
            </label>
          </>
        )}

        {mode !== 'usual' && (
          <label className="field">
            <span>Note</span>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={mode === 'cancelled' ? 'e.g. Teacher ill' : 'e.g. Room change'}
              maxLength={200}
            />
          </label>
        )}

        <p className="t-caption c-tertiary">Only {shortDate(lesson.date)} — other weeks stay as they are.</p>
        {error && <p className="t-caption c-now">{error.message}</p>}
      </PopoverForm>
    </Popover>
  )
}
