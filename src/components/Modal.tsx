import { useEffect, useRef, type ReactNode } from 'react'
import styles from './Modal.module.css'

/** Centered dialog (native <dialog>: focus trap + Escape for free). */
export function Modal({ title, onClose, children, footer, width = 720 }: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode; width?: number }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className={styles.modal}
      style={{ width: `min(${width}px, calc(100vw - 32px))` }}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()} // click on the backdrop
    >
      <div className={styles.inner}>
        <header className={styles.head}>
          <h2 className="t-heading">{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        <footer className={styles.foot}>{footer}</footer>
      </div>
    </dialog>
  )
}
