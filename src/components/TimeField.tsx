import { useState } from 'react'
import { parseTime } from '../lib/parseTime'

/**
 * Free time entry: type "840", "8.40" or "08:40". Every valid value is passed up immediately
 * (so a form submitted straight after typing gets it); the text is tidied to HH:MM on blur.
 */
export function TimeField({
  value,
  onChange,
  label,
  className = '',
}: {
  value: string
  onChange: (hhmm: string) => void
  label: string
  className?: string
}) {
  const [text, setText] = useState(value)
  const invalid = text.trim() !== '' && parseTime(text) === null
  return (
    <input
      className={`input input-mono ${className}`}
      value={text}
      inputMode="numeric"
      maxLength={5}
      aria-label={label}
      aria-invalid={invalid}
      placeholder="08:00"
      style={invalid ? { borderColor: 'var(--color-accent-now)' } : undefined}
      onChange={(e) => {
        setText(e.target.value)
        const t = parseTime(e.target.value)
        if (t) onChange(t)
      }}
      onBlur={() => setText(parseTime(text) ?? value)}
    />
  )
}
