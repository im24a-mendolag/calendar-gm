import { useState } from 'react'
import { Popover, PopoverForm } from '../../components/Popover'
import { useDeleteHoliday, useDeleteTerm, useSaveHoliday, useSaveTerm } from '../../lib/queries'

export interface DateRangeItem {
  id: string
  name: string
  startDate: string
  endDate: string
}

/** Create/edit a term or a holiday — both are just a named date range. */
export function DateRangePopover({
  kind,
  anchor,
  item,
  onClose,
}: {
  kind: 'term' | 'holiday'
  anchor: HTMLElement
  item?: DateRangeItem
  onClose: () => void
}) {
  const saveTerm = useSaveTerm()
  const saveHoliday = useSaveHoliday()
  const deleteTerm = useDeleteTerm()
  const deleteHoliday = useDeleteHoliday()
  const save = kind === 'term' ? saveTerm : saveHoliday
  const del = kind === 'term' ? deleteTerm : deleteHoliday
  const [name, setName] = useState(item?.name ?? '')
  const [startDate, setStart] = useState(item?.startDate ?? '')
  const [endDate, setEnd] = useState(item?.endDate ?? '')
  const noun = kind === 'term' ? 'term' : 'holiday'

  return (
    <Popover anchor={anchor} onClose={onClose} label={`${item ? 'Edit' : 'New'} ${noun}`}>
      <PopoverForm
        title={`${item ? 'Edit' : 'New'} ${noun}`}
        onSubmit={() => void save.mutateAsync({ id: item?.id, name, startDate, endDate }).then(onClose, () => {})}
        actions={
          <>
            {item ? (
              <button type="button" className="btn btn-danger" onClick={() => void del.mutateAsync(item.id).then(onClose, () => {})}>
                Delete
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className="btn btn-primary">
              {item ? 'Done' : 'Add'}
            </button>
          </>
        }
      >
        <label className="field">
          <span>Name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === 'term' ? 'Autumn term' : 'Autumn holidays'}
            required
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>First day</span>
            <input className="input input-mono" type="date" value={startDate} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label className="field">
            <span>Last day</span>
            <input className="input input-mono" type="date" value={endDate} min={startDate} onChange={(e) => setEnd(e.target.value)} required />
          </label>
        </div>
        {item && kind === 'term' && <p className="t-caption c-tertiary">Deleting a term also removes its timetable.</p>}
        {(save.error ?? del.error) && <p className="t-caption c-now">{(save.error ?? del.error)!.message}</p>}
      </PopoverForm>
    </Popover>
  )
}
