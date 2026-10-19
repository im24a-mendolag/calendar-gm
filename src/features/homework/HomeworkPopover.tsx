import { useState } from 'react'
import type { Homework } from '../../../shared/types'
import { Popover, PopoverForm } from '../../components/Popover'
import { useDeleteHomework, useSubjects, useUpdateHomework } from '../../lib/queries'
import styles from './Homework.module.css'

export function HomeworkPopover({ anchor, item, onClose }: { anchor: HTMLElement; item: Homework; onClose: () => void }) {
  const subjects = useSubjects()
  const update = useUpdateHomework()
  const remove = useDeleteHomework()
  const [title, setTitle] = useState(item.title)
  const [subjectId, setSubjectId] = useState(item.subjectId ?? '')
  const [dueDate, setDueDate] = useState(item.dueDate)
  const [notes, setNotes] = useState(item.notes ?? '')
  const error = update.error ?? remove.error

  return (
    <Popover anchor={anchor} onClose={onClose} label="Edit homework" width={320}>
      <PopoverForm
        title="Edit homework"
        onSubmit={() =>
          void update
            .mutateAsync({ id: item.id, title, subjectId: subjectId || null, dueDate, notes: notes || null })
            .then(onClose, () => {})
        }
        actions={
          <>
            <button type="button" className="btn btn-danger" onClick={() => void remove.mutateAsync(item.id).then(onClose, () => {})}>
              Delete
            </button>
            <button type="submit" className="btn btn-primary" disabled={!title.trim() || !dueDate}>
              Done
            </button>
          </>
        }
      >
        <label className="field">
          <span>Title</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Subject</span>
            <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">None</option>
              {subjects.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Due</span>
            <input className="input input-mono" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </label>
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea className={`input ${styles.textarea}`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {error && <p className="t-caption c-now">{error.message}</p>}
      </PopoverForm>
    </Popover>
  )
}
