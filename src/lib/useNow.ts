import { useEffect, useState } from 'react'
import { nowMinutes, todayIso } from './format'

/** Today's date and minutes since midnight, refreshed every 30 s. */
export function useNow() {
  const [now, setNow] = useState(() => ({ date: todayIso(), minutes: nowMinutes() }))
  useEffect(() => {
    const id = setInterval(() => setNow({ date: todayIso(), minutes: nowMinutes() }), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}
