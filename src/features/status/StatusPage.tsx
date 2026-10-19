import type { ReactNode } from 'react'
import styles from './StatusPage.module.css'

/** Shared layout for the 404 and error pages: small code, title, one sentence, actions. */
export function StatusPage({ code, title, children, actions }: { code: string; title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.body}>
        <span className="t-mono-small c-tertiary">{code}</span>
        <h1 className="t-title">{title}</h1>
        <div className={`c-secondary ${styles.text}`}>{children}</div>
        <div className={styles.actions}>{actions}</div>
      </div>
    </div>
  )
}
