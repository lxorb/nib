interface Ask {
  title: string
  /** Prefilled text, for a rename. */
  value?: string
  placeholder?: string
  confirmLabel?: string
}

interface Confirm {
  title: string
  /** What will happen, in one sentence. Shown under the title. */
  detail?: string
  confirmLabel?: string
  danger?: boolean
}

type Pending = { resolve: (answer: string | null) => void } | null

/** One small modal for the two questions the app ever asks: name this, and are
 *  you sure. Both resolve a promise, so the caller reads top to bottom. */
class Prompt {
  open = $state(false)
  mode = $state<'text' | 'confirm'>('text')
  title = $state('')
  detail = $state('')
  value = $state('')
  placeholder = $state('')
  confirmLabel = $state('')
  danger = $state(false)

  private pending: Pending = null

  /** Resolves to the typed text, or null if it was dismissed. */
  ask(options: Ask): Promise<string | null> {
    this.mode = 'text'
    this.title = options.title
    this.detail = ''
    this.value = options.value ?? ''
    this.placeholder = options.placeholder ?? ''
    this.confirmLabel = options.confirmLabel ?? 'Create'
    this.danger = false

    return this.show()
  }

  confirm(options: Confirm): Promise<boolean> {
    this.mode = 'confirm'
    this.title = options.title
    this.detail = options.detail ?? ''
    this.value = ''
    this.confirmLabel = options.confirmLabel ?? 'Confirm'
    this.danger = options.danger ?? false

    return this.show().then((answer) => answer !== null)
  }

  private show(): Promise<string | null> {
    // A second question replaces the first rather than stacking on it.
    this.pending?.resolve(null)
    this.open = true

    return new Promise((resolve) => {
      this.pending = { resolve }
    })
  }

  submit() {
    const answer = this.mode === 'confirm' ? '' : this.value.trim()
    if (this.mode === 'text' && !answer) return

    this.open = false
    this.pending?.resolve(answer)
    this.pending = null
  }

  dismiss() {
    this.open = false
    this.pending?.resolve(null)
    this.pending = null
  }
}

export const prompt = new Prompt()
