import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { addDays, daysBetween, isoWeekday } from '../../../shared/dates'
import type { Homework } from '../../../shared/types'
import { Icon } from '../../components/Icon'
import { shortDate, todayIso } from '../../lib/format'
import { nextLessonDate } from '../../lib/nextLesson'
import { useCreateHomework, useHolidays, useHomework, useSlots, useSubjects, useTerms } from '../../lib/queries'
import styles from './Homework.module.css'
import { HomeworkPopover } from './HomeworkPopover'
import { HomeworkRow } from './HomeworkRow'

/** Bucket open homework by due date relative to today. Weeks start on Monday. */
function groupOpen(items: Homework[], today: string) {
  const endOfWeek = addDays(today, 7 - isoWeekday(today))
  const endOfNextWeek = addDays(endOfWeek, 7)
  const groups: { key: string; label: string; urgent?: boolean; items: Homework[] }[] = [
    { key: 'overdue', label: 'Overdue', urgent: true, items: [] },
    { key: 'today', label: 'Today', items: [] },
    { key: 'tomorrow', label: `Tomorrow · ${shortDate(addDays(today, 1))}`, items: [] },
    { key: 'week', label: 'This week', items: [] },
    { key: 'next', label: 'Next week', items: [] },
    { key: 'later', label: 'Later', items: [] },
  ]
  for (const h of items) {
    const d = daysBetween(today, h.dueDate)
    const key =
      d < 0 ? 'overdue' : d === 0 ? 'today' : d === 1 ? 'tomorrow' : h.dueDate <= endOfWeek ? 'week' : h.dueDate <= endOfNextWeek ? 'next' : 'later'
    groups.find((g) => g.key === key)!.items.push(h)
  }
  return groups.filter((g) => g.items.length)
}

export function HomeworkPage() {
  const today = todayIso()
  const [view, setView] = useState<'open' | 'done'>('open')
  const open = useHomework('open')
  const done = useHomework('done')
  const subjects = useSubjects()
  const slots = useSlots()
  const terms = useTerms()
  const holidays = useHolidays()
  const create = useCreateHomework()
  const [editing, setEditing] = useState<{ item: Homework; anchor: HTMLElement } | null>(null)

  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTouched, setDueTouched] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const subjectById = useMemo(() => new Map((subjects.data ?? []).map((s) => [s.id, s])), [subjects.data])

  // "N" jumps to the quick-add field (like the Figma shortcut hint).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.target as HTMLElement).matches('input, textarea, select, [contenteditable]')) return
      e.preventDefault()
      titleRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Default due date: the subject's next lesson, else tomorrow — until you pick one yourself.
  const suggestedDue =
    (subjectId && slots.data && terms.data && holidays.data
      ? nextLessonDate(subjectId, { slots: slots.data, terms: terms.data, holidays: holidays.data }, today)
      : null) ?? addDays(today, 1)
  const effectiveDue = dueTouched && dueDate ? dueDate : suggestedDue

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await create.mutateAsync({ title, subjectId: subjectId || null, dueDate: effectiveDue }).catch(() => null)
    setTitle('')
    setDueTouched(false)
    titleRef.current?.focus()
  }

  const openItems = open.data ?? []
  const overdue = openItems.filter((h) => h.dueDate < today).length
  const groups = groupOpen(openItems, today)
  const perSubject = (subjects.data ?? [])
    .map((s) => ({ s, n: openItems.filter((h) => h.subjectId === s.id).length }))
    .filter((x) => x.n > 0)
  const noSubject = openItems.filter((h) => !h.subjectId).length
  const openEditor = (item: Homework) => (e: MouseEvent<HTMLButtonElement>) => setEditing({ item, anchor: e.currentTarget })

  return (
    <div>
      <header className="page-header">
        <div className="titles">
          <h1 className="t-title">Homework</h1>
          <p className="t-caption c-tertiary">
            {openItems.length} open{overdue ? ` · ${overdue} overdue` : ''}
          </p>
        </div>
        <div className="segmented" role="group" aria-label="Show">
          <button type="button" aria-pressed={view === 'open'} onClick={() => setView('open')}>
            Open
          </button>
          <button type="button" aria-pressed={view === 'done'} onClick={() => setView('done')}>
            Done
          </button>
        </div>
      </header>

      <div className={styles.columns}>
        <div className={styles.list}>
          <form className={styles.quickAdd} onSubmit={(e) => void add(e)}>
            <Icon name="plus" />
            <input
              ref={titleRef}
              className={styles.quickTitle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add homework…"
              aria-label="New homework"
              maxLength={200}
            />
            <select
              className={`input ${styles.quickSelect}`}
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              aria-label="Subject"
            >
              <option value="">No subject</option>
              {subjects.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              className={`input input-mono ${styles.quickDate}`}
              value={effectiveDue}
              onChange={(e) => {
                setDueDate(e.target.value)
                setDueTouched(true)
              }}
              aria-label="Due date"
              title={dueTouched ? undefined : subjectId ? 'Next lesson of this subject' : 'Tomorrow'}
            />
            <kbd className={`t-mono-small ${styles.kbd}`}>N</kbd>
          </form>
          {create.error && <p className="t-caption c-now">{create.error.message}</p>}

          {view === 'open' ? (
            groups.length === 0 ? (
              open.data && (
                <div className="card">
                  <div className="empty">
                    <h2 className="t-heading">All done</h2>
                    <p className="t-body c-secondary">No open homework. Add some above — press N to jump there.</p>
                  </div>
                </div>
              )
            ) : (
              groups.map((g) => (
                <section key={g.key} className={styles.group}>
                  <div className={styles.groupHead}>
                    <span className={`t-label ${g.urgent ? 'c-now' : 'c-tertiary'}`}>{g.label}</span>
                    <span className="t-mono-small c-tertiary">{g.items.length}</span>
                  </div>
                  <div className="card">
                    {g.items.map((h) => (
                      <HomeworkRow
                        key={h.id}
                        item={h}
                        subject={h.subjectId ? subjectById.get(h.subjectId) : undefined}
                        onOpen={openEditor(h)}
                      />
                    ))}
                  </div>
                </section>
              ))
            )
          ) : (
            <section className={styles.group}>
              <div className={styles.groupHead}>
                <span className="t-label c-tertiary">Done</span>
                <span className="t-mono-small c-tertiary">{done.data?.length ?? 0}</span>
              </div>
              <div className="card">
                {done.data?.length === 0 && <div className="card-row t-caption c-tertiary">Nothing ticked off yet.</div>}
                {done.data?.map((h) => (
                  <HomeworkRow key={h.id} item={h} subject={h.subjectId ? subjectById.get(h.subjectId) : undefined} onOpen={openEditor(h)} />
                ))}
              </div>
            </section>
          )}
        </div>

        {view === 'open' && openItems.length > 0 && (
          <aside className={styles.side}>
            <span className="t-label c-tertiary">By subject</span>
            <div className="card">
              {perSubject.map(({ s, n }) => (
                <div key={s.id} className="card-row" data-subject={s.color}>
                  <span className={styles.dot} />
                  <span className={styles.title} style={{ flex: 1 }}>
                    {s.name}
                  </span>
                  <span className="t-mono-small c-secondary">{n}</span>
                </div>
              ))}
              {noSubject > 0 && (
                <div className="card-row">
                  <span className={styles.dot} />
                  <span className="c-secondary" style={{ flex: 1 }}>
                    No subject
                  </span>
                  <span className="t-mono-small c-secondary">{noSubject}</span>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {editing && <HomeworkPopover anchor={editing.anchor} item={editing.item} onClose={() => setEditing(null)} />}
    </div>
  )
}
