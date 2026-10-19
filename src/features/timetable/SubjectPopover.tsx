import { useState } from 'react'
import { SUBJECT_COLORS, type SubjectColor } from '../../../shared/constants'
import type { Subject } from '../../../shared/types'
import { Popover, PopoverForm } from '../../components/Popover'
import { useCreateSubject, useDeleteSubject, useUpdateSubject } from '../../lib/queries'
import styles from './TimetablePage.module.css'

export function SubjectPopover({
  anchor,
  subject,
  usedColors,
  onClose,
}: {
  anchor: HTMLElement
  /** Undefined = create a new subject. */
  subject?: Subject
  usedColors: SubjectColor[]
  onClose: () => void
}) {
  const create = useCreateSubject()
  const update = useUpdateSubject()
  const remove = useDeleteSubject()
  const [name, setName] = useState(subject?.name ?? '')
  const [color, setColor] = useState<SubjectColor>(
    subject?.color ?? SUBJECT_COLORS.find((c) => !usedColors.includes(c)) ?? 'blue',
  )
  const [teacher, setTeacher] = useState(subject?.teacher ?? '')
  const [room, setRoom] = useState(subject?.defaultRoom ?? '')
  const error = create.error ?? update.error ?? remove.error

  async function save() {
    const data = { name, color, teacher: teacher || null, defaultRoom: room || null }
    if (subject) await update.mutateAsync({ id: subject.id, ...data })
    else await create.mutateAsync(data)
    onClose()
  }

  return (
    <Popover anchor={anchor} onClose={onClose} label={subject ? 'Edit subject' : 'New subject'}>
      <PopoverForm
        title={subject ? 'Edit subject' : 'New subject'}
        onSubmit={() => void save().catch(() => {})}
        actions={
          <>
            {subject ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void remove.mutateAsync(subject.id).then(onClose, () => {})}
              >
                Delete
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              {subject ? 'Done' : 'Add'}
            </button>
          </>
        }
      >
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maths" required />
        </label>
        <div className="field">
          <span>Colour</span>
          <div className={styles.colors} role="radiogroup" aria-label="Colour">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === color}
                aria-label={c}
                data-subject={c}
                className={styles.colorOption}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Teacher</span>
            <input className="input" value={teacher} onChange={(e) => setTeacher(e.target.value)} />
          </label>
          <label className="field">
            <span>Usual room</span>
            <input className="input input-mono" value={room} onChange={(e) => setRoom(e.target.value)} />
          </label>
        </div>
        {subject && <p className="t-caption c-tertiary">Deleting a subject also removes its lessons from the timetable.</p>}
        {error && <p className="t-caption c-now">{error.message}</p>}
      </PopoverForm>
    </Popover>
  )
}
