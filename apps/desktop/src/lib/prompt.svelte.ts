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

export interface Choice {
  id: string
  label: string
  primary?: boolean
  danger?: boolean
}

interface Choose {
  title: string
  detail?: string
  options: Choice[]
}

type Pending = { resolve: (answer: string | null) => void } | null

/** One small modal for the two questions the app ever asks: name this, and are
 *  you sure. Both resolve a promise, so the caller reads top to bottom. */
class Prompt {
  open = $state(false)
  mode = $state<'text' | 'confirm' | 'choose'>('text')
  options = $state<Choice[]>([])
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

  /** More than two ways to answer — resolves the chosen id, or null if the
   *  question was dismissed, which always means "do nothing". */
  choose(options: Choose): Promise<string | null> {
    this.mode = 'choose'
    this.title = options.title
    this.detail = options.detail ?? ''
    this.value = ''
    this.options = options.options

    return this.show()
  }

  /** Answers a `choose` with one of its options. */
  pick(id: string) {
    this.open = false
    this.pending?.resolve(id)
    this.pending = null
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
