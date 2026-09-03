export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'nib:theme'

function preferred(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

class ThemeStore {
  current = $state<Theme>('dark')

  init() {
    this.set(preferred())
  }

  set(theme: Theme) {
    this.current = theme
    document.documentElement.dataset.theme = theme
    localStorage.setItem(STORAGE_KEY, theme)
  }

  toggle() {
    this.set(this.current === 'dark' ? 'light' : 'dark')
  }
}

export const theme = new ThemeStore()
