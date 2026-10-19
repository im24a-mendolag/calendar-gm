import { useState, type FormEvent } from 'react'
import { EVENT_KIND_LABELS } from '../../../shared/constants'
import type { Tag } from '../../../shared/types'
import { Popover, PopoverForm } from '../../components/Popover'
import { useCreateTag, useDeleteTag, useRenameTag, useTags } from '../../lib/queries'
import styles from './SettingsPage.module.css'

const BUILT_IN = ['Lesson', ...Object.values(EVENT_KIND_LABELS).filter((l) => l !== 'Event')]

export function TagsSection() {
  const tags = useTags()
  const create = useCreateTag()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<{ tag: Tag; anchor: HTMLElement } | null>(null)

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await create.mutateAsync({ name }).then(() => setName(''), () => {})
  }

  return (
    <section className={styles.section}>
      <h2 className="t-heading">Tags</h2>
      <p className="t-caption c-secondary">
        Your own tags for events, like "Bring laptop" or "Graded". They show after the built-in tag; when a card is
        too narrow the rest collapse into +N.
      </p>
      <div className="card">
        <div className={`card-row ${styles.tagRow}`}>
          <span className={`t-caption c-tertiary ${styles.tagRowLabel}`}>Built in</span>
          <span className={styles.chips}>
            {BUILT_IN.map((t) => (
              <span key={t} className={`t-label ${styles.chip} ${styles.chipBuiltIn}`}>
                {t}
              </span>
            ))}
          </span>
        </div>
        {tags.data?.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`card-row ${styles.rowButton}`}
            onClick={(e) => setEditing({ tag: t, anchor: e.currentTarget })}
          >
            <span className={`t-label ${styles.chip}`}>{t.name}</span>
            <span className={`t-caption c-tertiary ${styles.grow}`}>
              {t.eventCount === 0 ? 'not used yet' : `on ${t.eventCount} event${t.eventCount === 1 ? '' : 's'}`}
            </span>
          </button>
        ))}
        <form className="card-row" onSubmit={(e) => void add(e)}>
          <input
            className={`input ${styles.grow}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New tag, e.g. Bring laptop"
            maxLength={30}
            aria-label="New tag name"
          />
          <button type="submit" className="btn btn-secondary" disabled={!name.trim() || create.isPending}>
            Add tag
          </button>
        </form>
      </div>
      {create.error && <p className="t-caption c-now">{create.error.message}</p>}
      {editing && <TagPopover tag={editing.tag} anchor={editing.anchor} onClose={() => setEditing(null)} />}
    </section>
  )
}

function TagPopover({ tag, anchor, onClose }: { tag: Tag; anchor: HTMLElement; onClose: () => void }) {
  const rename = useRenameTag()
  const remove = useDeleteTag()
  const [name, setName] = useState(tag.name)
  const error = rename.error ?? remove.error
  return (
    <Popover anchor={anchor} onClose={onClose} label="Edit tag" width={260}>
      <PopoverForm
        title="Edit tag"
        onSubmit={() => void rename.mutateAsync({ id: tag.id, name }).then(onClose, () => {})}
        actions={
          <>
            <button type="button" className="btn btn-danger" onClick={() => void remove.mutateAsync(tag.id).then(onClose, () => {})}>
              Delete
            </button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              Done
            </button>
          </>
        }
      >
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required />
        </label>
        {tag.eventCount > 0 && (
          <p className="t-caption c-tertiary">
            Deleting removes it from {tag.eventCount} event{tag.eventCount === 1 ? '' : 's'}.
          </p>
        )}
        {error && <p className="t-caption c-now">{error.message}</p>}
      </PopoverForm>
    </Popover>
  )
}
