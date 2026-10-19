import { useState } from 'react'
import { useCreateTag, useTags } from '../../lib/queries'
import styles from './EventPopover.module.css'

/** Toggle the user's tags on/off; "+ New" creates a tag and selects it right away. */
export function TagPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const tags = useTags()
  const create = useCreateTag()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  async function addTag() {
    if (!name.trim()) return
    const tag = await create.mutateAsync({ name }).catch(() => null)
    if (!tag) return
    onChange([...value, tag.id])
    setName('')
    setAdding(false)
  }

  return (
    <div className="field">
      <span>Tags</span>
      <div className={styles.tagPicker}>
        {tags.data?.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`t-label ${styles.tagOption}`}
            aria-pressed={value.includes(t.id)}
            onClick={() => toggle(t.id)}
          >
            {t.name}
          </button>
        ))}
        {adding ? (
          <input
            className={`input ${styles.tagInput}`}
            value={name}
            autoFocus
            maxLength={30}
            placeholder="Tag name"
            aria-label="New tag name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void addTag()
              }
              if (e.key === 'Escape') {
                e.stopPropagation()
                setAdding(false)
              }
            }}
            onBlur={() => (name.trim() ? void addTag() : setAdding(false))}
          />
        ) : (
          <button type="button" className={`t-label ${styles.tagOption} ${styles.tagNew}`} onClick={() => setAdding(true)}>
            + New
          </button>
        )}
      </div>
      {create.error && <span className="t-caption c-now">{create.error.message}</span>}
    </div>
  )
}
