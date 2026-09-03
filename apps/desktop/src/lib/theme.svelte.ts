import { invoke, isDesktop } from './tauri'

export type Scheme = 'dark' | 'light'

export interface ThemeInfo {
  id: string
  name: string
  scheme: Scheme
  path?: string
}

interface ThemeFile {
  id: string
  name: string
  path: string
}

const STORAGE_KEY = 'nib:theme'
const STYLE_ID = 'nib-user-theme'

const BUILT_IN: ThemeInfo[] = [
  { id: 'dark', name: 'Nib dark', scheme: 'dark' },
  { id: 'light', name: 'Nib light', scheme: 'light' },
  { id: 'slate', name: 'Slate', scheme: 'dark' },
  { id: 'paper', name: 'Paper', scheme: 'light' },
]

function systemScheme(): Scheme {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

class Themes {
  id = $state<string>('dark')
  files = $state<ThemeInfo[]>([])

  readonly all = $derived([...BUILT_IN, ...this.files])
  readonly active = $derived(this.all.find((theme) => theme.id === this.id) ?? BUILT_IN[0])
  readonly current = $derived(this.active.scheme)

  init() {
    const saved = localStorage.getItem(STORAGE_KEY)
    this.id = saved && saved !== 'null' ? saved : systemScheme()
    this.apply()
    void this.reload()
  }

  /** Rescans the themes folder, so dropping in a file needs no restart. */
  async reload() {
    if (!isDesktop) return

    try {
      const found = await invoke<ThemeFile[]>('list_themes')
      const loaded: ThemeInfo[] = []

      for (const file of found) {
        const css = await invoke<string>('read_theme', { path: file.path })
        loaded.push({
          ...file,
          scheme: /color-scheme\s*:\s*light/.test(css) ? 'light' : 'dark',
        })
      }

      this.files = loaded
    } catch {
      this.files = []
    }

    // A theme file may have been deleted while it was selected.
    if (!this.all.some((theme) => theme.id === this.id)) this.select(systemScheme())
  }

  select(id: string) {
    this.id = id
    this.apply()
    localStorage.setItem(STORAGE_KEY, id)
  }

  /** The rail's one-click switch: jump to the counterpart scheme. */
  toggle() {
    const wanted: Scheme = this.current === 'dark' ? 'light' : 'dark'
    const preferred = this.all.find((theme) => theme.id === wanted)
    const fallback = this.all.find((theme) => theme.scheme === wanted)
    this.select((preferred ?? fallback ?? BUILT_IN[0]).id)
  }

  private apply() {
    const theme = this.active
    // Built-in tokens still provide the base, so a file theme only overrides
    // what it cares about.
    document.documentElement.dataset.theme = theme.path ? theme.scheme : theme.id

    if (!theme.path) return this.inject('')
    void invoke<string>('read_theme', { path: theme.path }).then((css) => this.inject(css))
  }

  private inject(css: string) {
    let style = document.getElementById(STYLE_ID)

    if (!css) {
      style?.remove()
      return
    }

    if (!style) {
      style = document.createElement('style')
      style.id = STYLE_ID
      document.head.append(style)
    }
    style.textContent = css
  }
}

export const theme = new Themes()
