export type ThemeChoice = 'light' | 'dark' | 'system'
const KEY = 'theme'

export function getTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

/** Light/Dark force a theme via [data-theme]; System removes it so tokens.css follows the OS. */
export function applyTheme(choice: ThemeChoice = getTheme()) {
  const root = document.documentElement
  if (choice === 'system') delete root.dataset.theme
  else root.dataset.theme = choice
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    // storage unavailable (private mode) — theme still applies for this session
  }
}
