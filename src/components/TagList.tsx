import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './TagList.module.css'

/** Tags may use at most this share of the row — the title always keeps the rest. */
const MAX_SHARE = 0.5
const GAP = 4
const PLUS_WIDTH = 34 // a "+99" chip

/**
 * Tags in a block's title row. Shows as many as fit; the rest collapse into "+N",
 * which lists every tag on hover / keyboard focus.
 * The width budget is the parent row (shared with the title), found via our own wrapper element —
 * a ref passed down from the parent would still be null when this layout effect first runs.
 */
export function TagList({ tags, interactive = true }: { tags: string[]; interactive?: boolean }) {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  // How many tags to show, and the max width of a shown tag (longer ones get "…").
  const [fit, setFit] = useState({ visible: tags.length, maxWidth: Infinity })
  const [hover, setHover] = useState<DOMRect | null>(null)

  useLayoutEffect(() => {
    const row = wrapRef.current?.parentElement
    const measure = measureRef.current
    if (!row || !measure) return
    const update = () => {
      const budget = Math.floor(row.clientWidth * MAX_SHARE)
      const widths = [...measure.children].map((c) => (c as HTMLElement).offsetWidth)
      const plusFor = (shown: number) => (shown < widths.length ? GAP + PLUS_WIDTH : 0)
      let used = 0
      let count = 0
      for (let i = 0; i < widths.length; i++) {
        const next = used + (count ? GAP : 0) + widths[i]
        if (next + plusFor(i + 1) > budget) break
        used = next
        count++
      }
      // Not even the first tag fits: show it shortened instead of only "+N".
      if (count === 0) setFit({ visible: 1, maxWidth: Math.max(budget - plusFor(1), 24) })
      else setFit({ visible: count, maxWidth: Infinity })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(row)
    return () => ro.disconnect()
  }, [tags])

  if (tags.length === 0) return null
  const { visible, maxWidth } = fit
  const hidden = tags.length - visible

  return (
    <span ref={wrapRef} className={styles.wrap}>
      {/* invisible copy used only to measure each tag's natural width */}
      <span ref={measureRef} className={styles.measure} aria-hidden="true">
        {tags.map((t, i) => (
          <span key={i} className={`t-label ${styles.tag}`}>
            {t}
          </span>
        ))}
      </span>

      <span className={styles.list}>
        {tags.slice(0, visible).map((t, i) => (
          <span
            key={i}
            className={`t-label ${styles.tag} ${styles.shown}`}
            style={maxWidth === Infinity ? undefined : { maxWidth }}
            title={maxWidth === Infinity ? undefined : t}
          >
            {t}
          </span>
        ))}
        {hidden > 0 && (
          <span
            className={`t-label ${styles.tag} ${styles.more}`}
            tabIndex={interactive ? 0 : undefined}
            aria-label={`${hidden} more tags: ${tags.slice(visible).join(', ')}`}
            onMouseEnter={(e) => setHover(e.currentTarget.getBoundingClientRect())}
            onMouseLeave={() => setHover(null)}
            onFocus={(e) => setHover(e.currentTarget.getBoundingClientRect())}
            onBlur={() => setHover(null)}
          >
            +{hidden}
          </span>
        )}
      </span>

      {hover &&
        createPortal(
          <span
            role="tooltip"
            className={styles.tooltip}
            style={{ top: hover.bottom + 6, left: Math.min(hover.left, window.innerWidth - 240) }}
          >
            {tags.map((t, i) => (
              <span key={i} className={`t-label ${styles.tooltipTag}`}>
                {t}
              </span>
            ))}
          </span>,
          document.body,
        )}
    </span>
  )
}
