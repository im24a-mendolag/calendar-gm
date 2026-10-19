import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import type { SubjectColor } from '../../shared/constants'
import styles from './Block.module.css'
import { TagList } from './TagList'

export type BlockVariant = 'lesson' | 'assessed' | 'personal' | 'cancelled' | 'tagged'

/**
 * A block in a time grid — the Figma "Event Block" component.
 *  lesson    tinted subject colour + 3px left rule
 *  assessed  solid subject colour (Exam / Test / Presentation)
 *  personal  neutral surface + ink left rule (Appointment, Interview…)
 *  tagged    like lesson (Deadline, changed lesson, school event)
 *  cancelled dashed, struck through
 * Tags sit right of the title; the ones that don't fit collapse into "+N".
 */
export function Block({
  variant,
  color,
  title,
  meta,
  tags = [],
  style,
  onClick,
  selected,
  children,
}: {
  variant: BlockVariant
  color?: SubjectColor | null
  title: string
  meta?: string
  tags?: string[]
  style?: CSSProperties
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  selected?: boolean
  children?: ReactNode
}) {
  const className = `${styles.block} ${styles[variant]} ${selected ? styles.selected : ''}`
  const content = (
    <>
      <span className={styles.top}>
        <span className={`t-body-strong ${styles.title}`}>{title}</span>
        {/* "+N" isn't focusable inside a button (no nested controls); the button label lists all tags instead */}
        <TagList tags={tags} interactive={!onClick} />
      </span>
      {meta && <span className={`t-mono-small ${styles.meta}`}>{meta}</span>}
      {children}
    </>
  )
  return onClick ? (
    <button
      type="button"
      className={className}
      style={style}
      data-subject={color ?? undefined}
      onClick={onClick}
      aria-label={[title, meta, tags.length ? `Tags: ${tags.join(', ')}` : ''].filter(Boolean).join(', ')}
    >
      {content}
    </button>
  ) : (
    <div className={className} style={style} data-subject={color ?? undefined}>
      {content}
    </div>
  )
}
