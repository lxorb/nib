import { EditorView, WidgetType } from '@codemirror/view'
import { imageResolver } from '../images'

export class BulletWidget extends WidgetType {
  constructor(private readonly depth: number) {
    super()
  }

  eq(other: BulletWidget) {
    return other.depth === this.depth
  }

  toDOM() {
    const dot = document.createElement('span')
    dot.className = 'nib-bullet'
    dot.dataset.depth = String(Math.min(this.depth, 2))
    return dot
  }
}

export class CheckboxWidget extends WidgetType {
  constructor(
    private readonly checked: boolean,
    private readonly from: number,
    private readonly to: number,
  ) {
    super()
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.from === this.from
  }

  toDOM(view: EditorView) {
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.className = 'nib-checkbox'
    box.checked = this.checked

    box.addEventListener('mousedown', (event) => {
      event.preventDefault()
      view.dispatch({
        changes: { from: this.from, to: this.to, insert: this.checked ? '[ ]' : '[x]' },
      })
    })

    return box
  }

  ignoreEvent() {
    return false
  }
}

export class RuleWidget extends WidgetType {
  eq() {
    return true
  }

  toDOM() {
    const rule = document.createElement('span')
    rule.className = 'nib-rule'
    return rule
  }
}

/** GitHub-style alert headers. The kind is the one word worth showing. */
export class CalloutWidget extends WidgetType {
  constructor(private readonly kind: string) {
    super()
  }

  eq(other: CalloutWidget) {
    return other.kind === this.kind
  }

  toDOM() {
    const label = document.createElement('span')
    label.className = 'nib-callout-label'
    label.dataset.kind = this.kind
    label.textContent = this.kind.charAt(0).toUpperCase() + this.kind.slice(1)
    return label
  }
}

/** Sits on a code fence's top line: what language it is, and a way to take it. */
export class FenceHeaderWidget extends WidgetType {
  constructor(
    private readonly language: string,
    private readonly code: string,
  ) {
    super()
  }

  eq(other: FenceHeaderWidget) {
    return other.language === this.language && other.code === this.code
  }

  toDOM() {
    const bar = document.createElement('span')
    bar.className = 'nib-fence-header'
    bar.contentEditable = 'false'

    if (this.language) {
      const label = document.createElement('span')
      label.className = 'nib-fence-language'
      label.textContent = this.language
      bar.append(label)
    }

    const copy = document.createElement('button')
    copy.className = 'nib-fence-copy'
    copy.type = 'button'
    copy.title = 'Copy'
    copy.setAttribute('aria-label', 'Copy code')
    copy.textContent = 'Copy'

    copy.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()

      void navigator.clipboard.writeText(this.code).then(() => {
        copy.textContent = 'Copied'
        window.setTimeout(() => (copy.textContent = 'Copy'), 1400)
      })
    })

    bar.append(copy)
    return bar
  }

  ignoreEvent() {
    return true
  }
}

/** Shows `:smile:` as the character it names. */
export class EmojiWidget extends WidgetType {
  constructor(private readonly character: string) {
    super()
  }

  eq(other: EmojiWidget) {
    return other.character === this.character
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'nib-emoji'
    span.textContent = this.character
    return span
  }
}

export class ImageWidget extends WidgetType {
  constructor(
    private readonly src: string,
    private readonly alt: string,
  ) {
    super()
  }

  eq(other: ImageWidget) {
    return other.src === this.src && other.alt === this.alt
  }

  toDOM(view: EditorView) {
    const image = document.createElement('img')
    image.className = 'nib-image'
    image.src = view.state.facet(imageResolver)(this.src)
    image.alt = this.alt
    image.loading = 'lazy'
    image.title = this.alt || this.src
    return image
  }
}
