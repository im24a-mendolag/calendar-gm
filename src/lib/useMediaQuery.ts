import { useSyncExternalStore } from 'react'

/** True while the CSS media query matches, e.g. useMediaQuery('(max-width: 760px)'). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

/** Phone layout breakpoint — keep in sync with the 760px media queries in the CSS. */
export const useIsPhone = () => useMediaQuery('(max-width: 760px)')
