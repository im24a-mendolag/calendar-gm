import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './Popover.module.css'

/**
 * Floating panel anchored next to an element (the clicked lesson, a button…).
 * Closes on Escape and on clicks outside. Flips to the left / clamps to the viewport.
 */
export function Popover({
  anchor,
  onClose,
  width = 288,
  label,
  children,
}: {
  anchor: HTMLElement
  onClose: () => void
  width?: number
  label: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const a = anchor.getBoundingClientRect()
    const h = ref.current?.offsetHeight ?? 0
    const gap = 8
    let left = a.right + gap
    if (left + width > window.innerWidth - gap) left = a.left - width - gap
    left = Math.max(gap, Math.min(left, window.innerWidth - width - gap))
    const top = Math.max(gap, Math.min(a.top - 8, window.innerHeight - h - gap))
    setPos({ top, left })
  }, [anchor, width])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !anchor.contains(t)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [anchor, onClose])

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, select, button')?.focus()
  }, [])

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className={styles.popover}
      style={{ width, top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
    >
      {children}
    </div>,
    document.body,
  )
}

/** Standard popover layout: head / fields / actions, matching the Figma "Edit Popover". */
export function PopoverForm({
  title,
  meta,
  onSubmit,
  actions,
  children,
}: {
  title: string
  meta?: string
  onSubmit: () => void
  actions: ReactNode
  children: ReactNode
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <div className={styles.head}>
        <span className="t-body-strong">{title}</span>
        {meta && <span className="t-mono-small c-tertiary">{meta}</span>}
      </div>
      <div className={styles.fields}>{children}</div>
      <div className={styles.actions}>{actions}</div>
    </form>
  )
}
