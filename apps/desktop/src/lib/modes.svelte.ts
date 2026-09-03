import { setFocusMode, setSourceMode, setTypewriterMode, type EditorView } from '@nib/editor'

const STORAGE_KEY = 'nib:modes'
const ZOOM_STEPS = [0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6, 1.8, 2]

interface Saved {
  source: boolean
  focus: boolean
  typewriter: boolean
  zoom: number
}

class Modes {
  source = $state(false)
  focus = $state(false)
  typewriter = $state(false)
  zoom = $state(1)

  restore() {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const state = JSON.parse(saved) as Saved
        this.source = !!state.source
        this.focus = !!state.focus
        this.typewriter = !!state.typewriter
        this.zoom = state.zoom || 1
      } catch {
        // A corrupt entry just means defaults.
      }
    }
    this.applyZoom()
  }

  /** Re-applies every mode to a freshly created view. */
  apply(view: EditorView) {
    setSourceMode(view, this.source)
    setFocusMode(view, this.focus)
    setTypewriterMode(view, this.typewriter)
  }

  toggleSource(view?: EditorView) {
    this.source = !this.source
    if (view) setSourceMode(view, this.source)
    this.persist()
  }

  toggleFocus(view?: EditorView) {
    this.focus = !this.focus
    if (view) setFocusMode(view, this.focus)
    this.persist()
  }

  toggleTypewriter(view?: EditorView) {
    this.typewriter = !this.typewriter
    if (view) setTypewriterMode(view, this.typewriter)
    this.persist()
  }

  stepZoom(direction: number) {
    const index = ZOOM_STEPS.indexOf(this.zoom)
    const from = index >= 0 ? index : ZOOM_STEPS.indexOf(1)
    const next = Math.min(ZOOM_STEPS.length - 1, Math.max(0, from + direction))

    this.zoom = ZOOM_STEPS[next]
    this.applyZoom()
    this.persist()
  }

  resetZoom() {
    this.zoom = 1
    this.applyZoom()
    this.persist()
  }

  private applyZoom() {
    document.documentElement.style.setProperty('--zoom', String(this.zoom))
  }

  private persist() {
    const state: Saved = {
      source: this.source,
      focus: this.focus,
      typewriter: this.typewriter,
      zoom: this.zoom,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }
}

export const modes = new Modes()
