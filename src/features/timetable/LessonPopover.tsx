import { useState } from 'react'
import { toMinutes } from '../../../shared/dates'
import type { LessonSlot, Subject } from '../../../shared/types'
import { Popover, PopoverForm } from '../../components/Popover'
import { WEEKDAYS_SHORT } from '../../lib/format'
import { useCreateSlot, useDeleteSlot, useUpdateSlot } from '../../lib/queries'

/** Add or edit one weekly lesson. Times are free — any start and end. */
export function LessonPopover({
  anchor,
  slot,
  weekday,
  startTime: start0,
  endTime: end0,
  termId,
  termName,
  subjects,
  onClose,
}: {
  anchor: HTMLElement
  /** Existing lesson to edit; otherwise a new one is created. */
  slot?: LessonSlot
  weekday: number
  startTime: string
  endTime: string
  termId: string
  termName: string
  subjects: Subject[]
  onClose: () => void
}) {
  const create = useCreateSlot()
  const update = useUpdateSlot()
  const remove = useDeleteSlot()
  const [subjectId, setSubjectId] = useState(slot?.subjectId ?? '')
  const [startTime, setStart] = useState(slot?.startTime ?? start0)
  const [endTime, setEnd] = useState(slot?.endTime ?? end0)
  const [room, setRoom] = useState(slot?.room ?? '')
  // Until you type a room yourself, it follows the subject's usual room.
  const [roomTouched, setRoomTouched] = useState(Boolean(slot))
  // Empty = the subject's teacher (shown as the placeholder); fill it in when this lesson has someone else.
  const [teacher, setTeacher] = useState(slot?.teacher ?? '')
  const subjectTeacher = subjects.find((s) => s.id === subjectId)?.teacher ?? ''
  const error = create.error ?? update.error ?? remove.error
  const timesOk = toMinutes(endTime) > toMinutes(startTime)

  async function save() {
    if (!subjectId || !timesOk) return
    const data = { subjectId, weekday, startTime, endTime, room: room || null, teacher: teacher.trim() || null }
    if (slot) await update.mutateAsync({ id: slot.id, ...data })
    else await create.mutateAsync({ ...data, termId })
    onClose()
  }

  return (
    <Popover anchor={anchor} onClose={onClose} label={slot ? 'Edit lesson' : 'Add lesson'}>
      <PopoverForm
        title={slot ? 'Edit lesson' : 'Add lesson'}
        meta={`${WEEKDAYS_SHORT[weekday - 1]} · ${startTime}–${endTime}`}
        onSubmit={() => void save().catch(() => {})}
        actions={
          <>
            {slot ? (
              <button type="button" className="btn btn-danger" onClick={() => void remove.mutateAsync(slot.id).then(onClose, () => {})}>
                Remove
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className="btn btn-primary" disabled={!subjectId || !timesOk}>
              Done
            </button>
          </>
        }
      >
        <label className="field">
          <span>Subject</span>
          <select
            className="input"
            value={subjectId}
            autoFocus={!slot}
            onChange={(e) => {
              setSubjectId(e.target.value)
              if (!roomTouched) setRoom(subjects.find((s) => s.id === e.target.value)?.defaultRoom ?? '')
            }}
          >
            {!subjectId && <option value="">Choose a subject…</option>}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field-row">
          <label className="field">
            <span>Start</span>
            <input className="input input-mono" type="time" value={startTime} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label className="field">
            <span>End</span>
            <input className="input input-mono" type="time" value={endTime} min={startTime} onChange={(e) => setEnd(e.target.value)} required />
          </label>
        </div>
        {!timesOk && <p className="t-caption c-now">The end must be after the start.</p>}
        <div className="field-row">
          <label className="field">
            <span>Room</span>
            <input
              className="input input-mono"
              value={room}
              maxLength={40}
              onChange={(e) => {
                setRoom(e.target.value)
                setRoomTouched(true)
              }}
            />
          </label>
          <label className="field">
            <span>Teacher</span>
            <input className="input" value={teacher} maxLength={60} placeholder={subjectTeacher} onChange={(e) => setTeacher(e.target.value)} />
          </label>
        </div>
        <p className="t-caption c-secondary">Every week · {termName}</p>
        {error && <p className="t-caption c-now">{error.message}</p>}
      </PopoverForm>
    </Popover>
  )
}
