import {
  setCodeLineNumbers,
  setFocusMode,
  setHeadingNumbers,
  setLineHeight,
  setMeasure,
  setRightToLeft,
  setSmartPunctuation,
  setSourceMode,
  setTypewriterMode,
  type EditorView,
} from '@nib/editor'

const STORAGE_KEY = 'nib:modes'
const ZOOM_STEPS = [0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6, 1.8, 2]

/** Writing column widths, in rem. */
export const WIDTHS = [32, 38, 42, 50, 60, 80] as const
export const LINE_HEIGHTS = [1.5, 1.62, 1.72, 1.85, 2] as const

interface Saved {
  source: boolean
  focus: boolean
  typewriter: boolean
  punctuation: boolean
  numbers: boolean
  lineNumbers: boolean
  rtl: boolean
  zoom: number
  width: number
  lineHeight: number
}

class Modes {
  source = $state(false)
  focus = $state(false)
  typewriter = $state(false)
  punctuation = $state(true)
  numbers = $state(false)
  lineNumbers = $state(false)
  rtl = $state(false)
  zoom = $state(1)
  width = $state(42)
  lineHeight = $state(1.72)

  restore() {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const state = JSON.parse(saved) as Saved
        this.source = !!state.source
        this.focus = !!state.focus
        this.typewriter = !!state.typewriter
        this.punctuation = state.punctuation ?? true
        this.numbers = !!state.numbers
        this.lineNumbers = !!state.lineNumbers
        this.rtl = !!state.rtl
        this.zoom = state.zoom || 1
        this.width = state.width || 42
        this.lineHeight = state.lineHeight || 1.72
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
    setSmartPunctuation(view, this.punctuation)
    setHeadingNumbers(view, this.numbers)
    setCodeLineNumbers(view, this.lineNumbers)
    setRightToLeft(view, this.rtl)
    setMeasure(view, this.width)
    setLineHeight(view, this.lineHeight)
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

  togglePunctuation(view?: EditorView) {
    this.punctuation = !this.punctuation
    if (view) setSmartPunctuation(view, this.punctuation)
    this.persist()
  }

  toggleNumbers(view?: EditorView) {
    this.numbers = !this.numbers
    if (view) setHeadingNumbers(view, this.numbers)
    this.persist()
  }

  toggleLineNumbers(view?: EditorView) {
    this.lineNumbers = !this.lineNumbers
    if (view) setCodeLineNumbers(view, this.lineNumbers)
    this.persist()
  }

  toggleRightToLeft(view?: EditorView) {
    this.rtl = !this.rtl
    if (view) setRightToLeft(view, this.rtl)
    this.persist()
  }

  /** Steps through the widths rather than offering a slider of nothing. */
  stepWidth(direction: number, view?: EditorView) {
    const index = WIDTHS.indexOf(this.width as (typeof WIDTHS)[number])
    const from = index >= 0 ? index : WIDTHS.indexOf(42)
    const next = Math.min(WIDTHS.length - 1, Math.max(0, from + direction))

    this.width = WIDTHS[next]
    if (view) setMeasure(view, this.width)
    this.persist()
  }

  stepLineHeight(direction: number, view?: EditorView) {
    const index = LINE_HEIGHTS.indexOf(this.lineHeight as (typeof LINE_HEIGHTS)[number])
    const from = index >= 0 ? index : LINE_HEIGHTS.indexOf(1.72)
    const next = Math.min(LINE_HEIGHTS.length - 1, Math.max(0, from + direction))

    this.lineHeight = LINE_HEIGHTS[next]
    if (view) setLineHeight(view, this.lineHeight)
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
      punctuation: this.punctuation,
      numbers: this.numbers,
      lineNumbers: this.lineNumbers,
      rtl: this.rtl,
      zoom: this.zoom,
      width: this.width,
      lineHeight: this.lineHeight,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }
}

export const modes = new Modes()
