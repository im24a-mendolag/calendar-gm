import { useState } from 'react'
import type { LessonSlot, Period, Subject } from '../../../shared/types'
import { Popover, PopoverForm } from '../../components/Popover'
import { WEEKDAYS_SHORT } from '../../lib/format'
import { useCreateSlot, useDeleteSlot, useUpdateSlot } from '../../lib/queries'

export interface LessonDraft {
  slot?: LessonSlot
  weekday: number
  fromPeriod: number
  toPeriod: number
}

export function LessonPopover({
  anchor,
  draft,
  termId,
  termName,
  subjects,
  periods,
  onClose,
}: {
  anchor: HTMLElement
  draft: LessonDraft
  termId: string
  termName: string
  subjects: Subject[]
  periods: Period[]
  onClose: () => void
}) {
  const create = useCreateSlot()
  const update = useUpdateSlot()
  const remove = useDeleteSlot()
  const [subjectId, setSubjectId] = useState(draft.slot?.subjectId ?? subjects[0]?.id ?? '')
  const [from, setFrom] = useState(draft.fromPeriod)
  const [to, setTo] = useState(draft.toPeriod)
  const [room, setRoom] = useState(draft.slot?.room ?? subjects[0]?.defaultRoom ?? '')
  // Until you type a room yourself, it follows the selected subject's usual room.
  const [roomTouched, setRoomTouched] = useState(Boolean(draft.slot))
  const error = create.error ?? update.error ?? remove.error

  const start = periods.find((p) => p.number === from)
  const end = periods.find((p) => p.number === Math.max(from, to))
  const subject = subjects.find((s) => s.id === subjectId)

  async function save() {
    if (!start || !end || !subjectId) return
    const data = { subjectId, weekday: draft.weekday, startTime: start.startTime, endTime: end.endTime, room: room || null }
    if (draft.slot) await update.mutateAsync({ id: draft.slot.id, ...data })
    else await create.mutateAsync({ ...data, termId })
    onClose()
  }

  const periodLabel = from === Math.max(from, to) ? `P${from}` : `P${from}–${Math.max(from, to)}`

  return (
    <Popover anchor={anchor} onClose={onClose} label={draft.slot ? 'Edit lesson' : 'Add lesson'}>
      <PopoverForm
        title={draft.slot ? 'Edit lesson' : 'Add lesson'}
        meta={`${WEEKDAYS_SHORT[draft.weekday - 1]} · ${periodLabel}`}
        onSubmit={() => void save().catch(() => {})}
        actions={
          <>
            {draft.slot ? (
              <button type="button" className="btn btn-danger" onClick={() => void remove.mutateAsync(draft.slot!.id).then(onClose, () => {})}>
                Remove
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className="btn btn-primary" disabled={!subjectId}>
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
            onChange={(e) => {
              setSubjectId(e.target.value)
              const next = subjects.find((s) => s.id === e.target.value)
              if (!roomTouched) setRoom(next?.defaultRoom ?? '')
            }}
            data-subject={subject?.color}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field-row">
          <label className="field">
            <span>From</span>
            <select className="input input-mono" value={from} onChange={(e) => setFrom(Number(e.target.value))}>
              {periods.map((p) => (
                <option key={p.number} value={p.number}>
                  {p.number} · {p.startTime}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>To</span>
            <select className="input input-mono" value={Math.max(from, to)} onChange={(e) => setTo(Number(e.target.value))}>
              {periods
                .filter((p) => p.number >= from)
                .map((p) => (
                  <option key={p.number} value={p.number}>
                    {p.number} · {p.endTime}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Room</span>
          <input
            className="input input-mono"
            value={room}
            onChange={(e) => {
              setRoom(e.target.value)
              setRoomTouched(true)
            }}
          />
        </label>
        <p className="t-caption c-secondary">Every week · {termName}</p>
        {error && <p className="t-caption c-now">{error.message}</p>}
      </PopoverForm>
    </Popover>
  )
}
